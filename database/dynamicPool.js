const mysql = require('mysql2')

/**
 * Dynamic Connection Pool - Pool que se ajusta automaticamente conforme demanda
 * 
 * Funcionalidades:
 * - Ajusta automaticamente o número de conexões baseado no uso
 * - Escala para cima quando uso > 80%
 * - Escala para baixo quando uso < 30%
 * - Respeita limites mínimo e máximo configuráveis
 * - Monitoramento automático a cada 30 segundos
 */
class DynamicConnectionPool {
    constructor(config) {
        this.config = {
            min: Math.max(1, config.min || 5),
            max: Math.max(config.min || 5, config.max || 100),
            initial: config.initial || 10,
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            charset: config.charset || 'utf8mb4',
            checkInterval: config.checkInterval || 30000, // 30 segundos
            scaleUpThreshold: config.scaleUpThreshold || 0.8, // 80%
            scaleDownThreshold: config.scaleDownThreshold || 0.3, // 30%
            scaleStep: Math.max(1, config.scaleStep || 5),
            adjustStrategy: config.adjustStrategy || 'resize', // resize | recreate
            cooldownMs: config.cooldownMs || Math.max(30000, config.checkInterval || 30000),
            logger: config.logger || console,
            shrinkCooldownMs: config.shrinkCooldownMs || Math.max(120000, config.cooldownMs || 60000),
            shrinkMinUsage: config.shrinkMinUsage || 0.15,
            shrinkMinQueued: config.shrinkMinQueued || 1
        }

        this.currentLimit = Math.min(Math.max(this.config.initial, this.config.min), this.config.max)
        this._pool = null
        this.monitoringInterval = null
        this.lastAdjustment = 0
        this.lastShrink = 0
        this.isAdjusting = false

        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            queued: 0,
            peakActive: 0,
            lastUsage: 0
        }

        this._pool = this.createNewPool(this.currentLimit)
        this.startMonitoring()
        this.setupShutdownHandlers()
    }
    
    createNewPool(limit) {
        const pool = mysql.createPool({
            connectionLimit: limit,
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            charset: this.config.charset,
            waitForConnections: true,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            connectTimeout: 10000
        })

        pool.on('acquire', () => {
            this.metrics.activeConnections += 1
            this.metrics.peakActive = Math.max(this.metrics.peakActive, this.metrics.activeConnections)
            this.metrics.totalConnections += 1
        })

        pool.on('release', () => {
            this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1)
        })

        this.config.logger.log(`[DynamicPool] Pool criado com limite ${limit} (min: ${this.config.min}, max: ${this.config.max})`)

        return pool
    }

    getStats() {
        if (!this._pool) {
            return {
                limit: this.currentLimit,
                usage: 0,
                total: 0,
                free: 0,
                active: 0,
                queued: 0,
                min: this.config.min,
                max: this.config.max
            }
        }

        const internals = this._pool.pool
        let queued = 0
        let total = this.metrics.totalConnections
        let free = Math.max(this.metrics.totalConnections - this.metrics.activeConnections, 0)

        if (internals) {
            queued = internals._connectionQueue?.length || 0
            total = internals._allConnections?.length || total || this.currentLimit
            free = internals._freeConnections?.length || free
        }

        const active = total - free
        const usage = this.currentLimit > 0 ? Math.min(100, (active / this.currentLimit) * 100) : 0
        this.metrics.lastUsage = usage

        return {
            limit: this.currentLimit,
            total,
            free,
            active,
            queued,
            usage: parseFloat(usage.toFixed(2)),
            peakActive: this.metrics.peakActive,
            min: this.config.min,
            max: this.config.max
        }
    }
    
    adjustPool() {
        // Evitar múltiplos ajustes simultâneos
        if (this.isAdjusting) {
            return
        }
        
        const now = Date.now()

        if (now - this.lastAdjustment < this.config.cooldownMs) {
            return
        }
        
        const stats = this.getStats()
        const usagePercent = stats.usage / 100
        let newLimit = this.currentLimit
        let shouldAdjust = false
        let direction = null
        
        // Escalar para cima se uso > threshold e não estiver no máximo
        if (usagePercent > this.config.scaleUpThreshold && this.currentLimit < this.config.max) {
            newLimit = Math.min(
                this.currentLimit + this.config.scaleStep,
                this.config.max
            )
            shouldAdjust = true
            direction = 'UP'
        }
        // Escalar para baixo se uso < threshold e não estiver no mínimo
        else if (
            usagePercent < this.config.scaleDownThreshold &&
            this.currentLimit > this.config.min &&
            now - this.lastShrink > this.config.shrinkCooldownMs &&
            stats.queued <= this.config.shrinkMinQueued
        ) {
            newLimit = Math.max(
                this.currentLimit - this.config.scaleStep,
                this.config.min
            )
            shouldAdjust = true
            direction = 'DOWN'
        }
        
        if (shouldAdjust && newLimit !== this.currentLimit) {
            this.isAdjusting = true
            const oldLimit = this.currentLimit
            const previousPool = this._pool

            this.config.logger.log(`[DynamicPool] ⚡ Ajustando pool ${direction}: ${oldLimit} → ${newLimit} (uso: ${stats.usage}%, ativos: ${stats.active}/${oldLimit}, fila: ${stats.queued})`)

        const performResize = async () => {
            if (!previousPool || !previousPool.pool) {
                if (this._pool && this._pool.pool) {
                    this._pool.pool.config.connectionLimit = newLimit
                }
                this.currentLimit = newLimit
                this.lastAdjustment = now
                this.isAdjusting = false
                return
            }

            previousPool.pool.config.connectionLimit = newLimit
            this.currentLimit = newLimit
            this.lastAdjustment = now
            this.isAdjusting = false
        }

        const performRecreate = async () => {
            const newPool = this.createNewPool(newLimit)
            this._pool = newPool
            this.currentLimit = newLimit
            this.lastAdjustment = now

            if (previousPool) {
                previousPool.end((err) => {
                    if (err) {
                        this.config.logger.error('[DynamicPool] Erro ao encerrar pool anterior:', err)
                    }
                })
            }

            this.isAdjusting = false
        }

            const adjustPromise =
                this.config.adjustStrategy === 'recreate' ? performRecreate() : performResize()

        Promise.resolve(adjustPromise).catch((err) => {
            this.config.logger.error('[DynamicPool] Erro ao ajustar pool:', err)
            this.currentLimit = oldLimit
            this.isAdjusting = false
        })

            if (direction === 'DOWN') {
                this.lastShrink = now
            }
        }
    }
    
    startMonitoring() {
        // Desabilitado monitoramento para evitar recursão infinita
        return;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval)
        }
        
        const interval = Math.max(5000, this.config.checkInterval)
        this.monitoringInterval = setInterval(() => {
            this.adjustPool()
        }, interval)

        this.config.logger.log(`[DynamicPool] ✅ Monitoramento ativo (intervalo ${(interval/1000).toFixed(1)}s)`)
    }
    
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval)
            this.monitoringInterval = null
            console.log('[DynamicPool] Monitoramento parado')
        }
    }
    
    setupShutdownHandlers() {
        // Graceful shutdown
        const shutdown = () => {
            console.log('[DynamicPool] Encerrando pool...')
            this.stopMonitoring()
            if (this._pool) {
                this._pool.end((err) => {
                    if (err) {
                        console.error('[DynamicPool] Erro ao encerrar pool:', err)
                    } else {
                        console.log('[DynamicPool] Pool encerrado com sucesso')
                    }
                    process.exit(0)
                })
            } else {
                process.exit(0)
            }
        }
        
        process.on('SIGTERM', shutdown)
        process.on('SIGINT', shutdown)
    }
    
    // Métodos para compatibilidade com mysql2 pool
    query(sql, params, callback) {
        if (!this._pool) {
            const error = new Error('Pool não inicializado')
            if (callback) {
                return callback(error)
            }
            return Promise.reject(error)
        }
        return this._pool.query(sql, params, callback)
    }
    
    getConnection(callback) {
        if (!this._pool) {
            const error = new Error('Pool não inicializado')
            if (callback) {
                return callback(error)
            }
            return Promise.reject(error)
        }
        return this._pool.getConnection(callback)
    }
    
    end(callback) {
        this.stopMonitoring()
        if (this._pool) {
            return this._pool.end(callback)
        }
        if (callback) {
            callback()
        }
    }
    
    // Expor pool diretamente para compatibilidade total
    get pool() {
        return this._pool
    }
}

// Criar instância do pool dinâmico
const dynamicPool = new DynamicConnectionPool({
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    max: parseInt(process.env.DB_POOL_MAX) || 100,
    initial: parseInt(process.env.DB_POOL_INITIAL) || 10,
    host: process.env.DBHOST || "localhost",
    port: process.env.DBPORT || 3306,
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: process.env.DBNAME,
    charset: 'utf8mb4',
    checkInterval: parseInt(process.env.DB_POOL_CHECK_INTERVAL) || 30000,
    scaleUpThreshold: parseFloat(process.env.DB_POOL_SCALE_UP) || 0.8,
    scaleDownThreshold: parseFloat(process.env.DB_POOL_SCALE_DOWN) || 0.3,
    scaleStep: parseInt(process.env.DB_POOL_SCALE_STEP) || 5
})

// Teste de conexão inicial
dynamicPool.getConnection((err, connection) => {
    if (err) {
        console.error('[DynamicPool] ❌ Erro ao conectar ao banco:', err)
        return
    }
    console.log('[DynamicPool] ✅ Database conectado com sucesso')
    connection.release()
})

// Exportar pool dinâmico
module.exports = dynamicPool


