/**
 * ============================================================================
 * BullMQ Producers — Despachadores de Jobs
 * ============================================================================
 * Funções que recebem payloads do Baileys, fatiam em chunks e despacham
 * como jobs para as filas BullMQ.
 *
 * O handler do Baileys chama estas funções em vez de inserir direto no DB.
 * Isso desacopla a thread do WebSocket do I/O de banco.
 * ============================================================================
 */

const { coldStartQueue, hotPathQueue, mediaQueue, backgroundQueue } = require('./queues');

// ---------------------------------------------------------------------------
// Configuração de chunking (mesmo da Etapa 1, agora para serialização)
// ---------------------------------------------------------------------------
const CHAT_CHUNK_SIZE = 200;
const MSG_CHUNK_SIZE  = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fatia um array em chunks menores.
 * Retorna um generator para não alocar todos os sub-arrays de uma vez.
 */
function* chunkArray(arr, size) {
    for (let i = 0; i < arr.length; i += size) {
        yield { chunk: arr.slice(i, i + size), index: Math.floor(i / size) };
    }
}

/**
 * Flatten de mensagens do payload do Baileys.
 * data.messages pode ser:
 *   - Array de WAMessage (flat)
 *   - Array de { messages: WAMessage[] } (agrupado por chat)
 */
function flattenMessages(messages) {
    if (!messages?.length) return [];

    const result = [];
    for (const item of messages) {
        if (Array.isArray(item.messages)) {
            result.push(...item.messages);
        } else if (item.key) {
            result.push(item);
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Cold Start Producer
// ---------------------------------------------------------------------------

/**
 * Recebe o payload completo de messaging-history.set,
 * fatia em chunks e despacha como jobs para queue_cold_start.
 *
 * Cada chunk vira um job separado — o worker processa com concurrency=2.
 * Isso garante:
 *   1. Backpressure: o Redis absorve os chunks instantaneamente
 *   2. Proteção de memória: o payload original pode ser GC'd após dispatch
 *   3. Retry granular: se um chunk falha, só ele é retentado
 *
 * @param {Object} data - Payload do evento messaging-history.set
 * @param {string} instanceId - ID da sessão Baileys
 * @param {string} uid - ID do usuário
 * @returns {Object} Estatísticas de jobs despachados
 */
async function dispatchColdStart(data, instanceId, uid) {
    const startTime = Date.now();
    const jobs = [];

    // ── Fase 1: Chats ──
    const chats = data.chats || [];
    const totalChatChunks = Math.ceil(chats.length / CHAT_CHUNK_SIZE) || 0;

    for (const { chunk, index } of chunkArray(chats, CHAT_CHUNK_SIZE)) {
        jobs.push({
            name: `cold_chats_${instanceId}_${index}`,
            data: {
                type: 'chats',
                payload: chunk,
                instanceId,
                uid,
                chunkIndex: index,
                totalChunks: totalChatChunks,
            },
            opts: {
                // Chats primeiro — prioridade menor = maior urgência no BullMQ
                priority: 1,
            }
        });
    }

    // ── Fase 2: Mensagens ──
    const allMessages = flattenMessages(data.messages);
    const totalMsgChunks = Math.ceil(allMessages.length / MSG_CHUNK_SIZE) || 0;

    for (const { chunk, index } of chunkArray(allMessages, MSG_CHUNK_SIZE)) {
        jobs.push({
            name: `cold_msgs_${instanceId}_${index}`,
            data: {
                type: 'messages',
                payload: chunk,
                instanceId,
                uid,
                chunkIndex: index,
                totalChunks: totalMsgChunks,
            },
            opts: {
                // Mensagens depois dos chats
                priority: 2,
            }
        });
    }

    // Dispatch em bulk — uma única chamada ao Redis
    if (jobs.length > 0) {
        await coldStartQueue.addBulk(jobs);
    }

    const elapsed = Date.now() - startTime;
    console.log(
        `[ColdStartProducer] Dispatched instance=${instanceId} ` +
        `chatChunks=${totalChatChunks} msgChunks=${totalMsgChunks} ` +
        `totalJobs=${jobs.length} chats=${chats.length} msgs=${allMessages.length} ` +
        `dispatchTime=${elapsed}ms`
    );

    return {
        chatChunks: totalChatChunks,
        msgChunks: totalMsgChunks,
        totalJobs: jobs.length,
        totalChats: chats.length,
        totalMessages: allMessages.length,
        dispatchMs: elapsed,
    };
}

// ---------------------------------------------------------------------------
// Hot Path Producer
// ---------------------------------------------------------------------------

/**
 * Despacha uma mensagem em tempo real para queue_hot_path.
 * Chamado pelo handler de messages.upsert.
 *
 * @param {Array} messages - Array de WAMessage do Baileys (geralmente 1 item)
 * @param {string} instanceId - ID da sessão
 * @param {string} uid - ID do usuário
 */
async function dispatchHotPath(messages, instanceId, uid) {
    if (!messages?.length) return;

    await hotPathQueue.add(
        `hot_${instanceId}_${Date.now()}`,
        {
            payload: messages,
            instanceId,
            uid,
        },
        {
            // Sem priority — FIFO puro para latência mínima
        }
    );
}

// ---------------------------------------------------------------------------
// Media Processing Producer
// ---------------------------------------------------------------------------

/**
 * Despacha um job de download de mídia para queue_media_processing.
 * Chamado pelo HotPathWorker quando a mensagem é do tipo mídia.
 *
 * @param {Object} rawMessage - WAMessage original do Baileys (contém chaves de decriptação)
 * @param {Object} extractedMsg - Dados extraídos por extractFromBaileysMessage
 * @param {string} instanceId - ID da sessão
 * @param {string} uid - ID do usuário
 */
async function dispatchMediaProcessing(rawMessage, extractedMsg, instanceId, uid) {
    await mediaQueue.add(
        `media_${instanceId}_${extractedMsg.msgId}`,
        {
            rawMessage,
            msgId: extractedMsg.msgId,
            chatId: extractedMsg.chatId,
            msgType: extractedMsg.msgType,
            msgData: extractedMsg.msgData,
            instanceId,
            uid,
        },
        {
            // Sem priority — FIFO
        }
    );
}

/**
 * Configura tarefas repetíveis no BullMQ (Broadcast e Warmer).
 * Substitui os loops manuais do server.js.
 */
async function setupBackgroundTasks() {
    // ── Broadcast Job (Repetível a cada 1 minuto) ──
    const broadJob = await backgroundQueue.add(
        'broadcast_scheduler',
        { type: 'broadcast' },
        {
            repeat: {
                every: 60000, // 1 minuto
            },
            jobId: 'broadcast_repeatable',
        }
    );

    // ── Warmer Job (Repetível a cada 10 segundos) ──
    const warmJob = await backgroundQueue.add(
        'warmer_scheduler',
        { type: 'warmer' },
        {
            repeat: {
                every: 10000, // 10 segundos
            },
            jobId: 'warmer_repeatable',
        }
    );

    console.log('[BullMQ:Producers] Background tasks scheduled (Broadcast 1m, Warmer 10s)');
}

module.exports = { 
    dispatchColdStart, 
    dispatchHotPath, 
    dispatchMediaProcessing,
    setupBackgroundTasks 
};
