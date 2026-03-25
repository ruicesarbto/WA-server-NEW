/**
 * ============================================================================
 * Redis Hot Cache — Camada de leitura de alta performance
 * ============================================================================
 *
 * Estruturas de dados:
 *
 *   inbox:{instanceId}                 → ZSET (score = epochMs de last_message_at)
 *                                        member = chatId (jid)
 *
 *   chat:{instanceId}:{chatId}         → HASH (snapshot completo do chat para Inbox)
 *                                        fields: sender_name, sender_jid, profile_image,
 *                                        last_message, last_message_at, last_message_type,
 *                                        unread_count, is_read, is_pinned, chat_status, uid
 *
 *   msgs:{instanceId}:{chatId}         → LIST (últimas 50 mensagens, LPUSH + LTRIM)
 *                                        cada item = JSON stringified da mensagem
 *
 * TTL: 24h em todas as keys. Renovado a cada write.
 * Fallback: Se Redis vazio → lê do PG e popula o cache.
 *
 * ============================================================================
 */

const Redis = require('ioredis');
const { REDIS_CONFIG } = require('./connection');

// ---------------------------------------------------------------------------
// Singleton — uma conexão IORedis dedicada ao cache (separada do BullMQ)
// ---------------------------------------------------------------------------

let cacheClient = null;

function getCacheClient() {
    if (!cacheClient) {
        cacheClient = new Redis({
            ...REDIS_CONFIG,
            maxRetriesPerRequest: 3,       // Cache pode falhar rápido (diferente do BullMQ)
            enableReadyCheck: true,
            lazyConnect: false,
            db: parseInt(process.env.REDIS_CACHE_DB || '1', 10), // DB separado do BullMQ (db=0)
        });
        cacheClient.on('error', (err) => {
            console.error('[RedisCache] Connection error:', err.message);
        });
        cacheClient.on('connect', () => {
            console.log('[RedisCache] Connected — db=' + (process.env.REDIS_CACHE_DB || '1'));
        });
    }
    return cacheClient;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TTL = 60 * 60 * 24;            // 24h em segundos
const RECENT_MSG_CAP = 50;           // Últimas 50 mensagens por chat

// Key builders
const K = {
    inbox:   (instanceId)           => `inbox:${instanceId}`,
    chat:    (instanceId, chatId)   => `chat:${instanceId}:${chatId}`,
    msgs:    (instanceId, chatId)   => `msgs:${instanceId}:${chatId}`,
};

// ---------------------------------------------------------------------------
// 1. INBOX — Sorted Set (score = epochMs)
// ---------------------------------------------------------------------------

/**
 * Adiciona/atualiza um chat no ZSET da inbox.
 * Chamado pelo HotPathWorker após upsertChat no PG.
 *
 * Redis commands:
 *   ZADD inbox:{instanceId} {epochMs} {chatId}
 *   HSET chat:{instanceId}:{chatId} ...fields
 *   EXPIRE inbox:{instanceId} 86400
 *   EXPIRE chat:{instanceId}:{chatId} 86400
 */
async function cacheUpsertChat(instanceId, chatRow) {
    const redis = getCacheClient();
    const chatId = chatRow.chat_id;
    const epochMs = new Date(chatRow.last_message_at).getTime();

    const pipe = redis.pipeline();

    // ZADD — atualiza score (posição na inbox)
    pipe.zadd(K.inbox(instanceId), epochMs, chatId);

    // HSET — snapshot completo do chat
    pipe.hset(K.chat(instanceId, chatId), {
        id:                 String(chatRow.id || ''),
        chat_id:            chatId,
        instance_id:        instanceId,
        uid:                chatRow.uid || '',
        sender_name:        chatRow.sender_name || '',
        sender_jid:         chatRow.sender_jid || chatId,
        profile_image:      chatRow.profile_image || '',
        chat_status:        chatRow.chat_status || 'open',
        is_pinned:          chatRow.is_pinned ? '1' : '0',
        is_muted:           chatRow.is_muted ? '1' : '0',
        is_read:            chatRow.is_read ? '1' : '0',
        unread_count:       String(chatRow.unread_count || 0),
        last_message:       chatRow.last_message || '',
        last_message_at:    chatRow.last_message_at ? new Date(chatRow.last_message_at).toISOString() : '',
        last_message_type:  chatRow.last_message_type || 'text',
    });

    // Renova TTL
    pipe.expire(K.inbox(instanceId), TTL);
    pipe.expire(K.chat(instanceId, chatId), TTL);

    await pipe.exec();
}

/**
 * Lê a inbox completa do Redis.
 * Retorna array de chat objects ordenados por last_message_at DESC.
 * Retorna null se cache miss (ZSET vazio ou inexistente).
 *
 * Redis commands:
 *   ZREVRANGE inbox:{instanceId} 0 -1
 *   HGETALL chat:{instanceId}:{chatId}   (para cada membro)
 */
async function cacheGetInbox(instanceId) {
    const redis = getCacheClient();
    const inboxKey = K.inbox(instanceId);

    // Verifica se o ZSET existe
    const size = await redis.zcard(inboxKey);
    if (!size) return null; // Cache miss

    // ZREVRANGE = mais recente primeiro
    const chatIds = await redis.zrevrange(inboxKey, 0, -1);
    if (!chatIds.length) return null;

    // Pipeline para buscar todos os HASHes de uma vez
    const pipe = redis.pipeline();
    for (const chatId of chatIds) {
        pipe.hgetall(K.chat(instanceId, chatId));
    }
    const results = await pipe.exec();

    const chats = [];
    for (let i = 0; i < results.length; i++) {
        const [err, hash] = results[i];
        if (err || !hash || !hash.chat_id) continue;

        chats.push({
            id:                 parseInt(hash.id) || 0,
            chat_id:            hash.chat_id,
            instance_id:        hash.instance_id,
            uid:                hash.uid,
            sender_name:        hash.sender_name || null,
            sender_jid:         hash.sender_jid || hash.chat_id,
            profile_image:      hash.profile_image || null,
            chat_status:        hash.chat_status || 'open',
            is_pinned:          hash.is_pinned === '1',
            is_muted:           hash.is_muted === '1',
            is_read:            hash.is_read === '1',
            unread_count:       parseInt(hash.unread_count) || 0,
            last_message:       hash.last_message || null,
            last_message_at:    hash.last_message_at || null,
            last_message_type:  hash.last_message_type || 'text',
        });
    }

    // Renova TTL
    redis.expire(inboxKey, TTL).catch(() => {});

    return chats;
}

/**
 * Popula o cache da inbox a partir de rows do PostgreSQL.
 * Chamado no cache miss (fallback) ou pelo ColdStartWorker.
 */
async function cacheWarmInbox(instanceId, chatRows) {
    if (!chatRows?.length) return;
    const redis = getCacheClient();
    const pipe = redis.pipeline();

    for (const row of chatRows) {
        const chatId = row.chat_id;
        const epochMs = row.last_message_at ? new Date(row.last_message_at).getTime() : 0;

        pipe.zadd(K.inbox(instanceId), epochMs, chatId);
        pipe.hset(K.chat(instanceId, chatId), {
            id:                 String(row.id || ''),
            chat_id:            chatId,
            instance_id:        instanceId,
            uid:                row.uid || '',
            sender_name:        row.sender_name || '',
            sender_jid:         row.sender_jid || chatId,
            profile_image:      row.profile_image || '',
            chat_status:        row.chat_status || 'open',
            is_pinned:          row.is_pinned ? '1' : '0',
            is_muted:           row.is_muted ? '1' : '0',
            is_read:            row.is_read ? '1' : '0',
            unread_count:       String(row.unread_count || 0),
            last_message:       row.last_message || '',
            last_message_at:    row.last_message_at ? new Date(row.last_message_at).toISOString() : '',
            last_message_type:  row.last_message_type || 'text',
        });
        pipe.expire(K.chat(instanceId, chatId), TTL);
    }

    pipe.expire(K.inbox(instanceId), TTL);
    await pipe.exec();
}

// ---------------------------------------------------------------------------
// 2. MENSAGENS RECENTES — List (capped at 50)
// ---------------------------------------------------------------------------

/**
 * Adiciona uma mensagem ao topo da lista de recentes.
 * Chamado pelo HotPathWorker após insertMessage no PG.
 *
 * Redis commands:
 *   LPUSH msgs:{instanceId}:{chatId} {JSON}
 *   LTRIM msgs:{instanceId}:{chatId} 0 49
 *   EXPIRE msgs:{instanceId}:{chatId} 86400
 */
async function cachePushMessage(instanceId, chatId, msgObj) {
    const redis = getCacheClient();
    const key = K.msgs(instanceId, chatId);
    const json = JSON.stringify(msgObj);

    const pipe = redis.pipeline();
    pipe.lpush(key, json);
    pipe.ltrim(key, 0, RECENT_MSG_CAP - 1);
    pipe.expire(key, TTL);
    await pipe.exec();
}

/**
 * Lê as últimas N mensagens do cache Redis.
 * Retorna array em ordem cronológica (ASC) ou null se cache miss.
 *
 * Redis commands:
 *   LLEN  msgs:{instanceId}:{chatId}
 *   LRANGE msgs:{instanceId}:{chatId} 0 -1
 */
async function cacheGetMessages(instanceId, chatId) {
    const redis = getCacheClient();
    const key = K.msgs(instanceId, chatId);

    const len = await redis.llen(key);
    if (!len) return null; // Cache miss

    // LRANGE retorna do mais novo (index 0) ao mais antigo
    const raw = await redis.lrange(key, 0, -1);
    if (!raw.length) return null;

    // Parse e inverter para ordem cronológica (ASC)
    const messages = [];
    for (let i = raw.length - 1; i >= 0; i--) {
        try {
            messages.push(JSON.parse(raw[i]));
        } catch { /* skip malformed */ }
    }

    // Renova TTL
    redis.expire(key, TTL).catch(() => {});

    return messages;
}

/**
 * Popula o cache de mensagens a partir de rows do PostgreSQL.
 * rows devem estar em ordem cronológica ASC (mais antiga primeiro).
 */
async function cacheWarmMessages(instanceId, chatId, rows) {
    if (!rows?.length) return;
    const redis = getCacheClient();
    const key = K.msgs(instanceId, chatId);

    // Apagar lista existente e repopular
    const pipe = redis.pipeline();
    pipe.del(key);

    // Inserir do mais antigo ao mais novo (RPUSH mantém ordem)
    for (const row of rows) {
        pipe.rpush(key, JSON.stringify(row));
    }
    pipe.ltrim(key, -RECENT_MSG_CAP, -1); // Manter só os 50 mais recentes
    pipe.expire(key, TTL);
    await pipe.exec();
}

/**
 * Marca chat como lido no cache (zera unread_count, is_read=1).
 */
async function cacheMarkRead(instanceId, chatId) {
    const redis = getCacheClient();
    const key = K.chat(instanceId, chatId);
    await redis.hset(key, { is_read: '1', unread_count: '0' }).catch(() => {});
}

/**
 * Atualiza o campo `status` de uma mensagem específica na LIST do Redis.
 * Usa LRANGE para varrer e LSET para substituir o item em seu índice exato.
 * Não-bloqueante: falha silenciosa (o PG é a fonte de verdade).
 */
async function cacheUpdateMessageStatus(instanceId, chatId, msgId, newStatus) {
    const redis = getCacheClient();
    const key = K.msgs(instanceId, chatId);

    try {
        const items = await redis.lrange(key, 0, -1);
        for (let i = 0; i < items.length; i++) {
            const obj = JSON.parse(items[i]);
            if (obj.msg_id === msgId) {
                obj.status = newStatus;
                await redis.lset(key, i, JSON.stringify(obj));
                return true; // encontrou e atualizou
            }
        }
    } catch (err) {
        console.error('[RedisCache] cacheUpdateMessageStatus error:', err.message);
    }
    return false;
}

/**
 * Atualiza o campo `reaction` de uma mensagem específica na LIST do Redis.
 */
async function cacheUpdateMessageReaction(instanceId, chatId, msgId, reaction) {
    const redis = getCacheClient();
    const key = K.msgs(instanceId, chatId);

    try {
        const items = await redis.lrange(key, 0, -1);
        for (let i = 0; i < items.length; i++) {
            const obj = JSON.parse(items[i]);
            if (obj.msg_id === msgId) {
                obj.reaction = reaction;
                await redis.lset(key, i, JSON.stringify(obj));
                return true;
            }
        }
    } catch (err) {
        console.error('[RedisCache] cacheUpdateMessageReaction error:', err.message);
    }
    return false;
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

async function closeCacheClient() {
    if (cacheClient) {
        await cacheClient.quit().catch(() => {});
        cacheClient = null;
    }
}

module.exports = {
    getCacheClient,
    closeCacheClient,
    // Inbox
    cacheUpsertChat,
    cacheGetInbox,
    cacheWarmInbox,
    // Messages
    cachePushMessage,
    cacheGetMessages,
    cacheWarmMessages,
    // In-place updates (Ticks + Reações)
    cacheUpdateMessageStatus,
    cacheUpdateMessageReaction,
    // Actions
    cacheMarkRead,
    // Keys (for testing/debug)
    K,
};
