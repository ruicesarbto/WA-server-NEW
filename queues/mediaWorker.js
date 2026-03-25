/**
 * ============================================================================
 * MediaWorker — Processamento Assíncrono de Mídias
 * ============================================================================
 *
 * Consome jobs de `queue_media_processing` despachados pelo HotPathWorker.
 *
 * Fluxo por job:
 *   1. downloadMediaMessage (Baileys) → decripta mídia do CDN WhatsApp
 *   2. Salva buffer no disco: public/media/{instanceId}/{msgId}.{ext}
 *   3. UPDATE messages SET media_url = ? WHERE instance_id = ? AND msg_id = ?
 *   4. Atualiza Redis Hot Cache (mensagem no LIST msgs:{instanceId}:{chatId})
 *   5. Emite Socket.IO `media:ready` para o frontend atualizar a UI
 *
 * Concorrência: 3 (limitada por I/O de rede + disco)
 * Se falhar, o job será retentado com backoff exponencial (configurado na Queue).
 *
 * ============================================================================
 */

const { Worker } = require('bullmq');
const { getRedisConnection } = require('./connection');
const { getCacheClient, K } = require('./cache');
const { getIOInstance } = require('../socket');
const { query } = require('../database/dbpromise');
const con = require('../database/config');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map de msgType → extensão de arquivo padrão */
const EXT_MAP = {
    image:    'jpg',
    video:    'mp4',
    audio:    'ogg',
    document: 'bin',   // será sobrescrito pelo mimetype real quando possível
    sticker:  'webp',
};

/** Map de msgType → nome da propriedade de mensagem no Baileys */
const BAILEYS_TYPE_KEY = {
    image:    'imageMessage',
    video:    'videoMessage',
    audio:    'audioMessage',
    document: 'documentMessage',
    sticker:  'stickerMessage',
};

/**
 * Resolve a extensão do arquivo a partir do mimetype ou do fileName original.
 */
function resolveExtension(msgType, msgData) {
    // Se documento tem fileName com extensão, usar ela
    if (msgType === 'document' && msgData?.fileName) {
        const ext = path.extname(msgData.fileName).replace('.', '');
        if (ext) return ext;
    }

    // Tentar extrair do mimetype
    if (msgData?.mimetype) {
        const parts = msgData.mimetype.split('/');
        const sub = parts[1]?.split(';')[0]; // ex: "ogg; codecs=opus" → "ogg"
        if (sub === 'jpeg') return 'jpg';
        if (sub === 'webm') return 'webm';
        if (sub === 'mpeg') return msgType === 'audio' ? 'mp3' : 'mpg';
        if (sub === 'ogg') return 'ogg';
        if (sub === 'mp4') return 'mp4';
        if (sub === 'webp') return 'webp';
        if (sub === 'png') return 'png';
        if (sub === 'gif') return 'gif';
        if (sub === 'pdf') return 'pdf';
        if (sub) return sub;
    }

    return EXT_MAP[msgType] || 'bin';
}

/**
 * Busca o socket_id do usuário na tabela rooms.
 */
async function getUserSocketId(uid) {
    try {
        const rows = await query(`SELECT socket_id FROM rooms WHERE uid = ?`, [uid]);
        return rows[0]?.socket_id || null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Media Worker
// ---------------------------------------------------------------------------

let mediaWorker = null;

function startMediaWorker() {
    if (mediaWorker) return mediaWorker;

    mediaWorker = new Worker(
        'queue_media_processing',
        async (job) => {
            const { rawMessage, msgId, chatId, msgType, msgData, instanceId, uid } = job.data;

            console.log(`[MediaWorker] Processing job=${job.id} msg=${msgId} type=${msgType} instance=${instanceId}`);

            // ── 1. Download da mídia via Baileys ──
            // downloadMediaMessage funciona standalone (usa chaves no WAMessage para decriptar)
            let buffer;
            try {
                const baileys = await import('baileys');
                const downloadMediaMessage = baileys.downloadMediaMessage;

                buffer = await downloadMediaMessage(
                    rawMessage,
                    'buffer',
                    {},
                );
            } catch (dlErr) {
                console.error(`[MediaWorker] Download failed msg=${msgId}:`, dlErr.message);
                throw dlErr; // Retrigger retry via BullMQ
            }

            if (!buffer || buffer.length === 0) {
                console.warn(`[MediaWorker] Empty buffer for msg=${msgId}, skipping`);
                return { msgId, ok: false, reason: 'empty_buffer' };
            }

            // ── 2. Salvar no disco: public/media/{instanceId}/{msgId}.{ext} ──
            const ext = resolveExtension(msgType, msgData);
            const mediaDir = path.join(process.cwd(), 'public', 'media', instanceId);

            // Criar diretório se não existir
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
            }

            const fileName = `${msgId}.${ext}`;
            const filePath = path.join(mediaDir, fileName);
            fs.writeFileSync(filePath, buffer);

            // URL relativa que o frontend consegue acessar via Express static
            const mediaUrl = `/media/${instanceId}/${fileName}`;

            console.log(`[MediaWorker] Saved ${buffer.length} bytes → ${mediaUrl}`);

            // ── 3. UPDATE PostgreSQL ──
            try {
                await con.query(
                    `UPDATE messages SET media_url = $1 WHERE instance_id = $2 AND msg_id = $3`,
                    [mediaUrl, instanceId, msgId]
                );
            } catch (pgErr) {
                console.error(`[MediaWorker] PG update failed msg=${msgId}:`, pgErr.message);
                // Não re-throw: arquivo já foi salvo, PG pode ser atualizado manualmente
            }

            // ── 4. UPDATE Redis Hot Cache ──
            try {
                const redis = getCacheClient();
                const key = K.msgs(instanceId, chatId);
                const len = await redis.llen(key);
                if (len > 0) {
                    // Buscar todas as mensagens, encontrar a que tem o msgId, atualizar media_url
                    const raw = await redis.lrange(key, 0, -1);
                    for (let i = 0; i < raw.length; i++) {
                        try {
                            const parsed = JSON.parse(raw[i]);
                            if (parsed.msg_id === msgId) {
                                parsed.media_url = mediaUrl;
                                // LSET substitui o item no índice i
                                await redis.lset(key, i, JSON.stringify(parsed));
                                break;
                            }
                        } catch { /* skip malformed */ }
                    }
                }
            } catch (cacheErr) {
                console.error(`[MediaWorker] Cache update failed msg=${msgId}:`, cacheErr.message);
            }

            // ── 5. Emitir Socket.IO `media:ready` ──
            try {
                const io = getIOInstance();
                if (io) {
                    const socketId = await getUserSocketId(uid);
                    if (socketId) {
                        io.to(socketId).emit('media:ready', {
                            msgId,
                            chatId,
                            instanceId,
                            mediaUrl,
                            mediaType: msgType,
                        });
                    }
                }
            } catch (emitErr) {
                console.error(`[MediaWorker] Socket emit failed msg=${msgId}:`, emitErr.message);
            }

            return { msgId, ok: true, mediaUrl, bytes: buffer.length };
        },
        {
            connection: getRedisConnection(),
            concurrency: parseInt(process.env.MEDIA_WORKER_CONCURRENCY || '3', 10),
            // Sem limiter — backoff já é gerenciado pelo retry da Queue
        }
    );

    mediaWorker.on('completed', (job, result) => {
        if (result?.ok) {
            console.log(
                `[MediaWorker] DONE job=${job.id} msg=${result.msgId} ` +
                `size=${result.bytes}B url=${result.mediaUrl}`
            );
        }
    });

    mediaWorker.on('failed', (job, err) => {
        console.error(
            `[MediaWorker] FAILED job=${job?.id} attempt=${job?.attemptsMade}:`,
            err.message
        );
    });

    mediaWorker.on('error', (err) => {
        console.error('[MediaWorker] Worker error:', err.message);
    });

    console.log('[MediaWorker] Started — concurrency=3, retry=3x exponential');
    return mediaWorker;
}

async function stopMediaWorker() {
    if (mediaWorker) {
        await mediaWorker.close();
        mediaWorker = null;
    }
}

module.exports = { startMediaWorker, stopMediaWorker };
