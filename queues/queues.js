/**
 * ============================================================================
 * BullMQ Queue Definitions — Produtores
 * ============================================================================
 * Define as filas que recebem jobs. São instanciadas uma vez e reutilizadas.
 *
 * Filas:
 *   queue_cold_start  — Histórico massivo (messaging-history.set)
 *   queue_hot_path    — Mensagens em tempo real (messages.upsert)
 * ============================================================================
 */

const { Queue } = require('bullmq');
const { getRedisConnection } = require('./connection');

// ---------------------------------------------------------------------------
// Cold Start Queue
// ---------------------------------------------------------------------------
// Recebe chunks de chats/mensagens do messaging-history.set.
// Jobs são grandes (payload de centenas de KB) mas pouco frequentes.
// removeOnComplete/removeOnFail: limpa jobs finalizados para não inflar Redis.
const coldStartQueue = new Queue('queue_cold_start', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,            // 2s, 4s, 8s entre retries
        },
        removeOnComplete: { count: 100 },   // mantém últimos 100 para debug
        removeOnFail: { count: 500 },       // mantém últimos 500 falhas para análise
    }
});

// ---------------------------------------------------------------------------
// Hot Path Queue
// ---------------------------------------------------------------------------
// Recebe mensagens individuais de messages.upsert.
// Prioriza baixa latência: TTL curto, poucos retries.
const hotPathQueue = new Queue('queue_hot_path', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'fixed',
            delay: 500,             // retry rápido
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
    }
});

// ---------------------------------------------------------------------------
// Media Processing Queue
// ---------------------------------------------------------------------------
// Recebe jobs de download de mídia despachados pelo HotPathWorker.
// Operações de I/O pesado (download CDN + descriptografia + escrita em disco).
// Retry com backoff exponencial pois falhas são tipicamente de rede/rate-limit.
const mediaQueue = new Queue('queue_media_processing', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,            // 5s, 10s, 20s entre retries
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
    }
});

// ---------------------------------------------------------------------------
// Background Tasks Queue
// ---------------------------------------------------------------------------
// Filas para loops de segundo plano (Broadcast, Warmer).
// Jobs repetíveis (repeat) para manter a sincronização sem travar o Event Loop.
const backgroundQueue = new Queue('queue_background_tasks', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 1, // Falhas em loops repetíveis são tratadas no próximo ciclo
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
    }
});

module.exports = { coldStartQueue, hotPathQueue, mediaQueue, backgroundQueue };
