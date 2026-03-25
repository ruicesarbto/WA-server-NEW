/**
 * ============================================================================
 * Redis Connection — Shared across all BullMQ Queues and Workers
 * ============================================================================
 * BullMQ exige objetos de conexão separados para Queue (produtor) e Worker
 * (consumidor). Este módulo exporta factories para evitar reuso acidental
 * da mesma instância IORedis (que causa deadlock no BullMQ).
 *
 * Configuração via ENV:
 *   REDIS_HOST (default: localhost)
 *   REDIS_PORT (default: 6379)
 *   REDIS_PASSWORD (default: sem senha)
 *   REDIS_DB (default: 0)
 * ============================================================================
 */

const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: null,     // BullMQ requirement — never timeout on blocking commands
    enableReadyCheck: false,        // Faster startup
    retryStrategy(times) {
        // Reconnect com backoff: 50ms, 100ms, 200ms... max 3s
        return Math.min(times * 50, 3000);
    }
};

/**
 * Retorna um novo objeto de config para BullMQ Queue/Worker.
 * BullMQ aceita plain objects (IORedis options) e cria a conexão internamente.
 */
function getRedisConnection() {
    return { ...REDIS_CONFIG };
}

module.exports = { getRedisConnection, REDIS_CONFIG };
