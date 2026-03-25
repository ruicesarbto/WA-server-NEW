/**
 * ============================================================================
 * History Ingestion Engine — Cold Start
 * ============================================================================
 * Processa o evento messaging-history.set do Baileys com proteção de memória.
 *
 * Estratégia:
 *   1. Recebe o payload completo (chats[], messages[], contacts[])
 *   2. Fatia em chunks de tamanho configurável
 *   3. Monta uma única query VALUES multi-row por chunk (menos round-trips)
 *   4. Usa ON CONFLICT para idempotência (re-syncs não duplicam)
 *   5. Libera referências após cada chunk para permitir GC
 *
 * Usa translateSql() conforme diretriz obrigatória.
 * ============================================================================
 */

const { query } = require('./dbpromise');

// ---------------------------------------------------------------------------
// Configuração de chunking
// ---------------------------------------------------------------------------
const CHAT_CHUNK_SIZE = 200;
const MSG_CHUNK_SIZE  = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gera placeholders multi-row para INSERT em lote.
 * Ex: colCount=3, rowCount=2 → "($1,$2,$3),($4,$5,$6)"
 * Retorna string compatível com translateSql (usa $N nativo, bypass do ?).
 */
function buildMultiRowPlaceholders(colCount, rowCount) {
    const rows = [];
    let idx = 1;
    for (let r = 0; r < rowCount; r++) {
        const cols = [];
        for (let c = 0; c < colCount; c++) {
            cols.push(`$${idx++}`);
        }
        rows.push(`(${cols.join(',')})`);
    }
    return rows.join(',');
}

/**
 * Converte timestamp do WhatsApp (epoch seconds ou ms) para ISO string.
 */
function toTimestamp(ts) {
    if (!ts) return new Date().toISOString();
    // Baileys usa epoch seconds em alguns campos
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toISOString();
}

/**
 * Extrai texto legível de um objeto de mensagem Baileys.
 */
function extractMessageText(msg) {
    if (!msg?.message) return null;
    const m = msg.message;
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.buttonsResponseMessage?.selectedDisplayText ||
        m.listResponseMessage?.title ||
        m.templateButtonReplyMessage?.selectedDisplayText ||
        null
    );
}

/**
 * Detecta o tipo da mensagem Baileys.
 */
function detectMessageType(msg) {
    if (!msg?.message) return 'unknown';
    const m = msg.message;
    if (m.conversation || m.extendedTextMessage) return 'text';
    if (m.imageMessage)    return 'image';
    if (m.videoMessage)    return 'video';
    if (m.audioMessage)    return 'audio';
    if (m.documentMessage) return 'document';
    if (m.stickerMessage)  return 'sticker';
    if (m.contactMessage || m.contactsArrayMessage) return 'contact';
    if (m.locationMessage || m.liveLocationMessage) return 'location';
    if (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3) return 'poll';
    if (m.reactionMessage) return 'reaction';
    if (m.protocolMessage) return 'protocol';
    // Fallback: pega a primeira key do objeto message
    const keys = Object.keys(m);
    return keys[0]?.replace('Message', '') || 'unknown';
}

// ---------------------------------------------------------------------------
// Core: Upsert de Chats em chunks
// ---------------------------------------------------------------------------

/**
 * Insere/atualiza chats no banco em lotes.
 *
 * @param {Array} chats - Array de chat objects do Baileys
 * @param {string} instanceId - ID da sessão Baileys
 * @param {string} uid - ID do usuário dono da instância
 */
async function ingestChats(chats, instanceId, uid) {
    if (!chats?.length) return { inserted: 0, errors: 0 };

    const COL_COUNT = 12;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let offset = 0; offset < chats.length; offset += CHAT_CHUNK_SIZE) {
        const chunk = chats.slice(offset, offset + CHAT_CHUNK_SIZE);
        const params = [];

        for (const chat of chunk) {
            const chatId   = chat.id;
            const isGroup  = chatId?.endsWith('@g.us');
            const name     = chat.name || chat.subject || null;
            const lastMsg  = chat.conversationTimestamp
                ? toTimestamp(typeof chat.conversationTimestamp === 'object'
                    ? chat.conversationTimestamp.low
                    : chat.conversationTimestamp)
                : new Date().toISOString();

            params.push(
                chatId,                                         // chat_id
                instanceId,                                     // instance_id
                uid,                                            // uid
                name,                                           // sender_name
                chatId,                                         // sender_jid
                isGroup ? JSON.stringify(chat) : null,          // group_metadata
                chat.archived ? 'archived' : 'open',           // chat_status
                chat.pinned ? true : false,                     // is_pinned
                chat.mute ? true : false,                       // is_muted
                chat.unreadCount || 0,                          // unread_count
                lastMsg,                                        // last_message_at
                lastMsg                                         // updated_at
            );
        }

        const placeholders = buildMultiRowPlaceholders(COL_COUNT, chunk.length);

        // SQL nativo com $N — não passa por translateSql pois já está no formato PG
        const sql = `
            INSERT INTO chats (
                chat_id, instance_id, uid, sender_name, sender_jid,
                group_metadata, chat_status, is_pinned, is_muted,
                unread_count, last_message_at, updated_at
            )
            VALUES ${placeholders}
            ON CONFLICT (instance_id, chat_id) DO UPDATE SET
                sender_name     = COALESCE(EXCLUDED.sender_name, chats.sender_name),
                group_metadata  = COALESCE(EXCLUDED.group_metadata, chats.group_metadata),
                chat_status     = EXCLUDED.chat_status,
                is_pinned       = EXCLUDED.is_pinned,
                is_muted        = EXCLUDED.is_muted,
                unread_count    = EXCLUDED.unread_count,
                last_message_at = GREATEST(chats.last_message_at, EXCLUDED.last_message_at),
                updated_at      = NOW()
        `;

        try {
            const con = require('./config');
            await con.query(sql, params);
            totalInserted += chunk.length;
        } catch (err) {
            console.error(`[HistoryIngestion] Chat chunk error (offset=${offset}):`, err.message);
            totalErrors += chunk.length;
        }
    }

    return { inserted: totalInserted, errors: totalErrors };
}

// ---------------------------------------------------------------------------
// Core: Upsert de Messages em chunks
// ---------------------------------------------------------------------------

/**
 * Insere/atualiza mensagens no banco em lotes.
 * Também atualiza last_message/last_message_at na tabela chats.
 *
 * @param {Array} messages - Array de WAMessage do Baileys
 * @param {string} instanceId - ID da sessão Baileys
 * @param {string} uid - ID do usuário dono da instância
 */
async function ingestMessages(messages, instanceId, uid) {
    if (!messages?.length) return { inserted: 0, errors: 0 };

    const COL_COUNT = 14;
    let totalInserted = 0;
    let totalErrors = 0;

    // Map para trackear a última mensagem de cada chat (para update do chat)
    const chatLastMessage = new Map();

    for (let offset = 0; offset < messages.length; offset += MSG_CHUNK_SIZE) {
        const chunk = messages.slice(offset, offset + MSG_CHUNK_SIZE);
        const params = [];

        for (const msg of chunk) {
            const key     = msg.key;
            if (!key?.remoteJid || !key?.id) continue;

            const chatId  = key.remoteJid;
            const msgId   = key.id;
            const fromMe  = key.fromMe || false;
            const msgType = detectMessageType(msg);
            const msgBody = extractMessageText(msg);
            const ts      = toTimestamp(msg.messageTimestamp);
            const route   = fromMe ? 'outgoing' : 'incoming';

            // Quoted message info
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo
                || msg.message?.imageMessage?.contextInfo
                || msg.message?.videoMessage?.contextInfo
                || null;
            const quotedId     = contextInfo?.stanzaId || null;
            const quotedSender = contextInfo?.participant || null;

            const senderJid = fromMe
                ? null
                : (key.participant || chatId);

            params.push(
                msgId,                              // msg_id
                chatId,                             // chat_id
                instanceId,                         // instance_id
                uid,                                // uid
                senderJid,                          // sender_jid
                fromMe,                             // from_me
                msgType,                            // msg_type
                msgBody,                            // msg_body
                quotedId,                           // quoted_msg_id
                quotedSender,                       // quoted_sender
                'sent',                             // status
                route,                              // route
                ts,                                 // message_timestamp
                ts                                  // created_at
            );

            // Trackeia última mensagem por chat para bulk update depois
            const msgTs = msg.messageTimestamp
                ? (typeof msg.messageTimestamp === 'object'
                    ? msg.messageTimestamp.low
                    : Number(msg.messageTimestamp))
                : 0;
            const existing = chatLastMessage.get(chatId);
            if (!existing || msgTs > existing.ts) {
                chatLastMessage.set(chatId, {
                    ts: msgTs,
                    body: msgBody,
                    type: msgType,
                    isoTs: ts
                });
            }
        }

        // Pode ter pulado mensagens inválidas
        const actualRows = params.length / COL_COUNT;
        if (actualRows === 0) continue;

        const placeholders = buildMultiRowPlaceholders(COL_COUNT, actualRows);

        const sql = `
            INSERT INTO messages (
                msg_id, chat_id, instance_id, uid, sender_jid, from_me,
                msg_type, msg_body, quoted_msg_id, quoted_sender,
                status, route, message_timestamp, created_at
            )
            VALUES ${placeholders}
            ON CONFLICT (instance_id, msg_id) DO NOTHING
        `;

        try {
            const con = require('./config');
            await con.query(sql, params);
            totalInserted += actualRows;
        } catch (err) {
            console.error(`[HistoryIngestion] Message chunk error (offset=${offset}):`, err.message);
            totalErrors += actualRows;
        }
    }

    // Bulk update last_message nos chats correspondentes
    if (chatLastMessage.size > 0) {
        await updateChatLastMessages(chatLastMessage, instanceId);
    }

    return { inserted: totalInserted, errors: totalErrors };
}

// ---------------------------------------------------------------------------
// Atualiza last_message dos chats após ingestão de mensagens
// ---------------------------------------------------------------------------

async function updateChatLastMessages(chatLastMessage, instanceId) {
    const con = require('./config');
    const entries = Array.from(chatLastMessage.entries());

    // Processa em chunks menores para não travar a connection
    for (let i = 0; i < entries.length; i += CHAT_CHUNK_SIZE) {
        const chunk = entries.slice(i, i + CHAT_CHUNK_SIZE);

        // Usa um CTE com VALUES para fazer batch update em uma única query
        const params = [];
        const valueRows = [];
        let idx = 1;

        for (const [chatId, data] of chunk) {
            valueRows.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
            params.push(chatId, data.body, data.type, data.isoTs);
        }

        params.push(instanceId);
        const instanceParam = `$${idx}`;

        const sql = `
            UPDATE chats SET
                last_message      = v.body,
                last_message_type = v.type,
                last_message_at   = GREATEST(chats.last_message_at, v.ts::timestamptz),
                updated_at        = NOW()
            FROM (VALUES ${valueRows.join(',')}) AS v(chat_id, body, type, ts)
            WHERE chats.chat_id = v.chat_id
              AND chats.instance_id = ${instanceParam}
        `;

        try {
            await con.query(sql, params);
        } catch (err) {
            console.error('[HistoryIngestion] Chat last_message update error:', err.message);
        }
    }
}

// ---------------------------------------------------------------------------
// Orquestrador principal
// ---------------------------------------------------------------------------

/**
 * Processa o evento messaging-history.set completo.
 * Executa chats primeiro (para garantir que existem), depois mensagens.
 *
 * @param {Object} data - Payload do evento messaging-history.set
 * @param {string} instanceId - ID da sessão
 * @param {string} uid - ID do usuário
 * @returns {Object} Estatísticas da ingestão
 */
async function processHistorySet(data, instanceId, uid) {
    const startTime = Date.now();

    const chatCount = data.chats?.length || 0;
    const msgCount  = data.messages?.length || 0;

    console.log(`[HistoryIngestion] START instance=${instanceId} chats=${chatCount} msgs=${msgCount}`);

    // Fase 1: Upsert de chats
    const chatResult = await ingestChats(data.chats, instanceId, uid);

    // Fase 2: Upsert de mensagens (sequencial, depois dos chats)
    // Flatten: data.messages é array de {messages: WAMessage[], ...} em algumas versões
    let allMessages = [];
    if (data.messages?.length > 0) {
        for (const item of data.messages) {
            if (Array.isArray(item.messages)) {
                // Formato agrupado por chat
                allMessages.push(...item.messages);
            } else if (item.key) {
                // Formato flat (cada item já é uma WAMessage)
                allMessages.push(item);
            }
        }
    }

    const msgResult = await ingestMessages(allMessages, instanceId, uid);

    // Libera referências para GC
    allMessages = null;

    const elapsed = Date.now() - startTime;
    console.log(
        `[HistoryIngestion] DONE instance=${instanceId} ` +
        `chats=${chatResult.inserted}/${chatCount} ` +
        `msgs=${msgResult.inserted}/${msgCount} ` +
        `errors=${chatResult.errors + msgResult.errors} ` +
        `elapsed=${elapsed}ms`
    );

    return {
        chats: chatResult,
        messages: msgResult,
        elapsedMs: elapsed
    };
}

module.exports = { processHistorySet, ingestChats, ingestMessages };
