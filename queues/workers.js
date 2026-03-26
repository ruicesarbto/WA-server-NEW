/**
 * ============================================================================
 * BullMQ Workers — Consumidores
 * ============================================================================
 *
 * cold_start_worker:
 *   - Concorrência: 2 (dois chunks em paralelo, controla WAL pressure)
 *   - Limiter: max 4 jobs/segundo
 *   - Processa chunks de chats e mensagens via historyIngestion.js
 *
 * hot_path_worker:
 *   - Concorrência: 5 (mensagens individuais, leves)
 *   - Prioriza latência: sem rate limit
 *   - Persiste mensagem → upsert chat → emite Socket.IO
 *
 * Os workers devem ser inicializados UMA vez no boot da aplicação.
 * ============================================================================
 */

const { Worker } = require('bullmq');
const { getRedisConnection } = require('./connection');
const { ingestChats, ingestMessages } = require('../database/historyIngestion');
const { emitNewMessage } = require('./realtime');
const { cacheUpsertChat, cachePushMessage, cacheWarmInbox, cacheWarmMessages, cacheUpdateMessageStatus, cacheUpdateMessageReaction } = require('./cache');
const { dispatchMediaProcessing } = require('./producers');
const { startMediaWorker, stopMediaWorker } = require('./mediaWorker');
const con = require('../database/config');

// Tipos de mensagem que contêm mídia para download
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

// ---------------------------------------------------------------------------
// Helpers — Hot Path DB Operations (queries nativas $N, sem translateSql)
// ---------------------------------------------------------------------------

/**
 * Insere uma mensagem individual na tabela messages.
 * Retorna a row inserida ou null se já existia (ON CONFLICT DO NOTHING).
 */
async function insertMessage(msg, instanceId, uid) {
    const sql = `
        INSERT INTO messages (
            msg_id, chat_id, instance_id, uid, sender_jid, sender_name,
            from_me, msg_type, msg_body, msg_data, quoted_msg_id, quoted_sender,
            status, route, message_timestamp, created_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16
        )
        ON CONFLICT (instance_id, msg_id) DO UPDATE SET
            status = EXCLUDED.status,
            msg_body = COALESCE(EXCLUDED.msg_body, messages.msg_body)
        RETURNING id, msg_id, chat_id, msg_type, msg_body, from_me, route, message_timestamp
    `;

    const params = [
        msg.msgId,
        msg.chatId,
        instanceId,
        uid,
        msg.senderJid,
        msg.senderName,
        msg.fromMe,
        msg.msgType,
        msg.msgBody,
        msg.msgData ? JSON.stringify(msg.msgData) : null,
        msg.quotedMsgId,
        msg.quotedSender,
        msg.status || 'sent',
        msg.route,
        msg.timestamp,
        msg.timestamp,
    ];

    const result = await con.query(sql, params);
    return result.rows[0] || null;
}

/**
 * Upsert do chat: cria se não existe, atualiza last_message se já existe.
 * Retorna a row do chat para emissão Socket.IO.
 *
 * IMPORTANTE: Resolve o cenário de "mensagem antes do chat" (quando hot path
 * chega antes do cold start terminar de criar o chat).
 */
async function upsertChat(msg, instanceId, uid) {
    // REGRA DE OURO: Para grupos (@g.us), nunca mexemos no sender_name por aqui.
    // Para chats privados, só atualizamos o nome se a mensagem NÃO for nossa (fromMe === false).
    const isGroup = msg.chatId.endsWith('@g.us');
    
    const sql = `
        INSERT INTO chats (
            chat_id, instance_id, uid, sender_name, sender_jid,
            chat_status, is_read, unread_count,
            last_message, last_message_at, last_message_type,
            updated_at
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11,
            NOW()
        )
        ON CONFLICT (instance_id, chat_id) DO UPDATE SET
            last_message      = EXCLUDED.last_message,
            last_message_at   = GREATEST(chats.last_message_at, EXCLUDED.last_message_at),
            last_message_type = EXCLUDED.last_message_type,
            -- Se for grupo ou se a mensagem for MINHA ($12), NÃO altera o sender_name
            sender_name       = CASE 
                                    WHEN $1 LIKE '%@g.us' THEN chats.sender_name
                                    WHEN $12 = TRUE THEN chats.sender_name
                                    ELSE COALESCE(EXCLUDED.sender_name, chats.sender_name)
                                END,
            -- Se a mensagem for minha ($12), o chat está lido. 
            -- Se for nova mensagem de terceiros, marca como não lido.
            is_read           = CASE 
                                    WHEN $12 = TRUE THEN TRUE
                                    WHEN EXCLUDED.last_message_at > chats.last_message_at THEN FALSE 
                                    ELSE chats.is_read 
                                END,
            -- Mensagem própria não incrementa o contador. 
            -- Nova mensagem de terceiros incrementa.
            unread_count      = CASE 
                                    WHEN $12 = TRUE THEN chats.unread_count
                                    WHEN EXCLUDED.last_message_at > chats.last_message_at THEN chats.unread_count + 1 
                                    ELSE chats.unread_count 
                                END,
            updated_at        = NOW()
        RETURNING *
    `;

    const isIncoming = msg.route === 'incoming';

    const params = [
        msg.chatId,                                     // $1
        instanceId,                                     // $2
        uid,                                            // $3
        msg.senderName,                                 // $4
        msg.chatId,                                     // $5
        'open',                                         // $6
        isIncoming ? false : true,                      // $7
        isIncoming ? 1 : 0,                             // $8
        msg.msgBody || `[${msg.msgType}]`,              // $9
        msg.timestamp,                                  // $10
        msg.msgType,                                    // $11
        msg.fromMe                                      // $12
    ];

    const result = await con.query(sql, params);
    return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Helper: Processa uma Reação (msgType === 'reaction')
// ---------------------------------------------------------------------------

const { getIOInstance } = require('../socket');
const { query: queryDb } = require('../database/dbpromise');

async function handleReaction(msg, instanceId, uid) {
    // msg.msgData.targetMsgId = msg_id da mensagem que recebeu a reação
    const targetMsgId = msg.msgData?.targetMsgId;
    const reaction = msg.msgBody || ''; // emoji ou '' (remoção de reação)
    const chatId = msg.chatId;

    if (!targetMsgId) {
        console.warn('[Reaction] No targetMsgId — skipping');
        return;
    }

    console.log(`[Reaction] chat=${chatId} target=${targetMsgId} emoji="${reaction}"`);

    // 1. Atualiza no PostgreSQL
    try {
        await con.query(
            `UPDATE messages SET reaction = $1 WHERE instance_id = $2 AND msg_id = $3`,
            [reaction || null, instanceId, targetMsgId]
        );
    } catch (err) {
        console.error('[Reaction:PG] Error:', err.message);
    }

    // 2. Atualiza no Redis Hot Cache (fire-and-forget)
    cacheUpdateMessageReaction(instanceId, chatId, targetMsgId, reaction).catch(() => {});

    // 3. Emite Socket.IO para o frontend
    try {
        const io = getIOInstance();
        if (io) {
            const users = await queryDb(
                `SELECT uid FROM user WHERE opened_chat_instance = ?`,
                [instanceId]
            );
            for (const u of (users || [])) {
                const rows = await queryDb(`SELECT socket_id FROM rooms WHERE uid = ?`, [u.uid]);
                const socketId = rows?.[0]?.socket_id;
                if (socketId) {
                    io.to(socketId).emit('message:reaction', {
                        instanceId,
                        chatId,
                        msgId: targetMsgId,
                        reaction,
                    });
                }
            }
        }
    } catch (err) {
        console.error('[Reaction:Socket] Error:', err.message);
    }
}

// ---------------------------------------------------------------------------
// Helper: Extrai dados mínimos de um WAMessage do Baileys
// ---------------------------------------------------------------------------

function extractFromBaileysMessage(raw) {
    const key = raw.key;
    if (!key?.remoteJid || !key?.id) return null;
    if (key.remoteJid === 'status@broadcast') return null;

    const m = raw.message || {};
    const fromMe = key.fromMe || false;

    // Tipo da mensagem
    let msgType = 'text';
    let msgBody = null;
    let msgData = null;

    if (m.conversation) {
        msgType = 'text';
        msgBody = m.conversation;
    } else if (m.extendedTextMessage) {
        msgType = 'text';
        msgBody = m.extendedTextMessage.text;
    } else if (m.imageMessage) {
        msgType = 'image';
        msgBody = m.imageMessage.caption || '';
        msgData = { mimetype: m.imageMessage.mimetype, url: m.imageMessage.url };
    } else if (m.videoMessage) {
        msgType = 'video';
        msgBody = m.videoMessage.caption || '';
        msgData = { mimetype: m.videoMessage.mimetype, seconds: m.videoMessage.seconds };
    } else if (m.audioMessage) {
        msgType = 'audio';
        msgData = { mimetype: m.audioMessage.mimetype, seconds: m.audioMessage.seconds, ptt: m.audioMessage.ptt };
    } else if (m.documentMessage) {
        msgType = 'document';
        msgBody = m.documentMessage.caption || m.documentMessage.fileName || '';
        msgData = { mimetype: m.documentMessage.mimetype, fileName: m.documentMessage.fileName };
    } else if (m.stickerMessage) {
        msgType = 'sticker';
        msgData = { mimetype: m.stickerMessage.mimetype };
    } else if (m.contactMessage || m.contactsArrayMessage) {
        msgType = 'contact';
    } else if (m.locationMessage || m.liveLocationMessage) {
        msgType = 'location';
        const loc = m.locationMessage || m.liveLocationMessage;
        msgData = { lat: loc.degreesLatitude, lng: loc.degreesLongitude };
    } else if (m.reactionMessage) {
        msgType = 'reaction';
        msgBody = m.reactionMessage.text;
        msgData = { targetMsgId: m.reactionMessage.key?.id };
    } else if (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3) {
        msgType = 'poll';
        const poll = m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3;
        msgBody = poll.name;
    } else if (m.protocolMessage) {
        msgType = 'protocol';
    } else {
        const keys = Object.keys(m);
        if (keys.length > 0) {
            msgType = keys[0].replace('Message', '');
        }
    }

    // Context info (quoted message)
    const contextInfo = m.extendedTextMessage?.contextInfo
        || m.imageMessage?.contextInfo
        || m.videoMessage?.contextInfo
        || m.documentMessage?.contextInfo
        || m.audioMessage?.contextInfo
        || null;

    // Timestamp
    const rawTs = raw.messageTimestamp;
    const epochSec = rawTs
        ? (typeof rawTs === 'object' ? rawTs.low : Number(rawTs))
        : Math.floor(Date.now() / 1000);
    const timestamp = new Date(epochSec * 1000).toISOString();

    return {
        msgId: key.id,
        chatId: key.remoteJid,
        fromMe,
        senderJid: fromMe ? null : (key.participant || key.remoteJid),
        senderName: raw.pushName || null,
        msgType,
        msgBody,
        msgData,
        quotedMsgId: contextInfo?.stanzaId || null,
        quotedSender: contextInfo?.participant || null,
        status: 'sent',
        route: fromMe ? 'outgoing' : 'incoming',
        timestamp,
        epochSec,
    };
}

// ---------------------------------------------------------------------------
// Cold Start Worker (unchanged from Etapa 2)
// ---------------------------------------------------------------------------

let coldStartWorker = null;

function startColdStartWorker() {
    if (coldStartWorker) return coldStartWorker;

    coldStartWorker = new Worker(
        'queue_cold_start',
        async (job) => {
            const { type, payload, instanceId, uid, chunkIndex, totalChunks } = job.data;

            console.log(
                `[ColdStartWorker] Processing job=${job.id} type=${type} ` +
                `chunk=${chunkIndex + 1}/${totalChunks} instance=${instanceId}`
            );

            let result;

            if (type === 'chats') {
                result = await ingestChats(payload, instanceId, uid);

                // ── Warm Redis inbox cache com os chats ingeridos ──
                // Busca os chats recém-inseridos do PG para garantir dados completos
                try {
                    const rows = await con.query(
                        `SELECT * FROM chats WHERE instance_id = $1 AND uid = $2
                         ORDER BY last_message_at DESC LIMIT 500`,
                        [instanceId, uid]
                    );
                    if (rows.rows?.length) {
                        await cacheWarmInbox(instanceId, rows.rows);
                        console.log(`[ColdStart:Cache] Inbox warmed: ${rows.rows.length} chats`);
                    }
                } catch (e) {
                    console.error('[ColdStart:Cache] Inbox warm failed:', e.message);
                }
            } else if (type === 'messages') {
                result = await ingestMessages(payload, instanceId, uid);
            } else {
                throw new Error(`Unknown job type: ${type}`);
            }

            console.log(
                `[ColdStartWorker] Done job=${job.id} type=${type} ` +
                `inserted=${result.inserted} errors=${result.errors}`
            );

            return result;
        },
        {
            connection: getRedisConnection(),
            concurrency: parseInt(process.env.COLD_START_CONCURRENCY || '2', 10),
            limiter: {
                max: parseInt(process.env.COLD_START_RATE_MAX || '4', 10),
                duration: 1000,
            },
        }
    );

    coldStartWorker.on('failed', (job, err) => {
        console.error(
            `[ColdStartWorker] FAILED job=${job?.id} attempt=${job?.attemptsMade}:`,
            err.message
        );
    });

    coldStartWorker.on('error', (err) => {
        console.error('[ColdStartWorker] Worker error:', err.message);
    });

    console.log('[ColdStartWorker] Started — concurrency=2, rate=4/s');
    return coldStartWorker;
}

// ---------------------------------------------------------------------------
// Hot Path Worker — Etapa 3
// ---------------------------------------------------------------------------
// Fluxo por job:
//   1. Extrair dados da WAMessage
//   2. INSERT mensagem no PostgreSQL
//   3. UPSERT chat (last_message, last_message_at, unread_count)
//   4. Emitir Socket.IO para o frontend
// ---------------------------------------------------------------------------

let hotPathWorker = null;

function startHotPathWorker() {
    if (hotPathWorker) return hotPathWorker;

    hotPathWorker = new Worker(
        'queue_hot_path',
        async (job) => {
            const { payload, instanceId, uid } = job.data;

            const results = [];

            for (const rawMsg of payload) {
                const msg = extractFromBaileysMessage(rawMsg);
                if (!msg) continue;

                // Reações são tratadas como update da mensagem alvo, não como insert
                if (msg.msgType === 'reaction') {
                    handleReaction(msg, instanceId, uid).catch(e =>
                        console.error(`[HotPath:Reaction] Failed msg=${msg.msgId}:`, e.message)
                    );
                    continue;
                }

                // Protocol messages (delete, ephemeral settings) — skip
                if (msg.msgType === 'protocol') continue;

                try {
                    // ── Fase 1: Persistir mensagem no PostgreSQL ──
                    const insertedMsg = await insertMessage(msg, instanceId, uid);

                    // ── Fase 2: Upsert chat no PostgreSQL ──
                    const chatRow = await upsertChat(msg, instanceId, uid);

                    // ── Fase 2.5: Write-through → Redis Hot Cache ──
                    // Executa em paralelo (fire-and-forget com catch).
                    // Se Redis falhar, o PG já tem os dados — zero data loss.
                    const msgForCache = {
                        msg_id: msg.msgId,
                        chat_id: msg.chatId,
                        instance_id: instanceId,
                        sender_jid: msg.senderJid,
                        sender_name: msg.senderName,
                        from_me: msg.fromMe,
                        msg_type: msg.msgType,
                        msg_body: msg.msgBody,
                        msg_data: msg.msgData,
                        media_url: null,
                        quoted_msg_id: msg.quotedMsgId,
                        quoted_sender: msg.quotedSender,
                        status: msg.status,
                        route: msg.route,
                        reaction: null,
                        is_starred: false,
                        message_timestamp: msg.timestamp,
                    };
                    await Promise.all([
                        cacheUpsertChat(instanceId, chatRow).catch(e =>
                            console.error('[HotPath:Cache] ZADD/HSET failed:', e.message)),
                        cachePushMessage(instanceId, msg.chatId, msgForCache).catch(e =>
                            console.error('[HotPath:Cache] LPUSH failed:', e.message)),
                    ]);

                    // ── Fase 3: Socket.IO ──
                    // DUAL PATH: O emit já foi feito pelo Fast Path no req.js (messages.upsert).
                    // O worker NÃO emite mais para evitar duplicação na UI.

                    results.push({ msgId: msg.msgId, ok: true });

                    // ── Fase 4: Se mídia → despacha para MediaWorker (async, non-blocking) ──
                    if (MEDIA_TYPES.has(msg.msgType)) {
                        dispatchMediaProcessing(rawMsg, msg, instanceId, uid).catch(e =>
                            console.error(`[HotPath:Media] Dispatch failed msg=${msg.msgId}:`, e.message)
                        );
                    }
                } catch (err) {
                    console.error(
                        `[HotPathWorker] Error msg=${msg.msgId} chat=${msg.chatId}:`,
                        err.message
                    );
                    results.push({ msgId: msg.msgId, ok: false, error: err.message });
                }
            }

            return { processed: results.length, results };
        },
        {
            connection: getRedisConnection(),
            concurrency: parseInt(process.env.HOT_PATH_CONCURRENCY || '5', 10),
            // Sem limiter — prioriza latência
        }
    );

    hotPathWorker.on('failed', (job, err) => {
        console.error(
            `[HotPathWorker] FAILED job=${job?.id} attempt=${job?.attemptsMade}:`,
            err.message
        );
    });

    hotPathWorker.on('error', (err) => {
        console.error('[HotPathWorker] Worker error:', err.message);
    });

    console.log('[HotPathWorker] Started — concurrency=5, no rate limit');
    return hotPathWorker;
}

// ---------------------------------------------------------------------------
// Boot / Shutdown
// ---------------------------------------------------------------------------

function startAllWorkers() {
    startColdStartWorker();
    startHotPathWorker();
    startMediaWorker();
    console.log('[QueueWorkers] All workers started (cold_start + hot_path + media)');
}

async function stopAllWorkers() {
    const promises = [];
    if (coldStartWorker) promises.push(coldStartWorker.close());
    if (hotPathWorker) promises.push(hotPathWorker.close());
    promises.push(stopMediaWorker());
    await Promise.all(promises);
    console.log('[QueueWorkers] All workers stopped');
}

module.exports = {
    startColdStartWorker,
    startHotPathWorker,
    startAllWorkers,
    stopAllWorkers
};
