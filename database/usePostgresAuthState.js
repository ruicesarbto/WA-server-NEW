/**
 * usePostgresAuthState - Gerenciamento de estado de autenticacao Baileys via PostgreSQL
 *
 * Substitui o useMultiFileAuthState (apenas para dev/testes) por uma implementacao
 * robusta usando banco de dados, seguindo as recomendacoes da documentacao Baileys:
 *
 * Vantagens:
 * - Atomicidade: operacoes SQL sao atomicas (sem corrupcao de dados)
 * - Performance: sem I/O em disco para dezenas de arquivos JSON por sessao
 * - Seguranca: dados nao ficam expostos em plain-text no filesystem
 * - Backup: PostgreSQL ja oferece pg_dump, replicacao, etc.
 * - Escalabilidade: multiplas sessoes sem race conditions
 *
 * Uso:
 *   const { state, saveCreds } = await usePostgresAuthState('sessionId');
 *   // Usa exatamente como useMultiFileAuthState
 */

const { query } = require('./dbpromise');

// Baileys proto + initAuthCreds serao carregados dinamicamente
let proto, initAuthCreds, BufferJSON;

const initBaileysProto = async () => {
    if (proto) return;
    const baileys = await import('baileys');
    proto = baileys.proto;
    initAuthCreds = baileys.initAuthCreds;
    BufferJSON = baileys.BufferJSON;
};

/**
 * Le um valor da tabela baileys_auth
 */
const readData = async (sessionId, keyType, keyId = '') => {
    const rows = await query(
        'SELECT value FROM baileys_auth WHERE session_id = ? AND key_type = ? AND key_id = ?',
        [sessionId, keyType, keyId]
    );
    if (rows.length === 0) return null;

    // O valor ja e JSONB, PostgreSQL retorna como objeto
    const raw = rows[0].value;
    return typeof raw === 'string' ? JSON.parse(raw, BufferJSON.reviver) : JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
};

/**
 * Escreve um valor na tabela baileys_auth (upsert)
 */
const writeData = async (sessionId, keyType, keyId, value) => {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    await query(
        `INSERT INTO baileys_auth (session_id, key_type, key_id, value, updated_at)
         VALUES (?, ?, ?, ?::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (session_id, key_type, key_id)
         DO UPDATE SET value = ?::jsonb, updated_at = CURRENT_TIMESTAMP`,
        [sessionId, keyType, keyId, serialized, serialized]
    );
};

/**
 * Remove um valor da tabela baileys_auth
 */
const removeData = async (sessionId, keyType, keyId) => {
    await query(
        'DELETE FROM baileys_auth WHERE session_id = ? AND key_type = ? AND key_id = ?',
        [sessionId, keyType, keyId]
    );
};

/**
 * Remove todos os dados de uma sessao
 */
const removeSession = async (sessionId) => {
    await query('DELETE FROM baileys_auth WHERE session_id = ?', [sessionId]);
};

/**
 * Funcao principal - drop-in replacement para useMultiFileAuthState
 *
 * @param {string} sessionId - ID da sessao Baileys
 * @returns {{ state: AuthenticationState, saveCreds: () => Promise<void> }}
 */
const usePostgresAuthState = async (sessionId) => {
    await initBaileysProto();

    // Ler credenciais existentes ou inicializar novas
    const existingCreds = await readData(sessionId, 'creds');
    const creds = existingCreds || initAuthCreds();

    // Se credenciais sao novas, salvar imediatamente
    if (!existingCreds) {
        await writeData(sessionId, 'creds', '', creds);
    }

    return {
        state: {
            creds,
            keys: {
                /**
                 * Obter chaves por tipo e IDs
                 * @param {string} type - Tipo da chave (pre-key, session, app-state-sync-key, etc.)
                 * @param {string[]} ids - Array de IDs para buscar
                 */
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        try {
                            const value = await readData(sessionId, type, id);
                            if (value) {
                                // Tipos que precisam de deserializacao especial
                                if (type === 'app-state-sync-key' && value) {
                                    data[id] = proto.Message.AppStateSyncKeyData.fromObject(value);
                                } else {
                                    data[id] = value;
                                }
                            }
                        } catch (err) {
                            console.error(`[PG Auth] Error reading ${type}/${id}:`, err.message);
                        }
                    }
                    return data;
                },

                /**
                 * Salvar chaves por tipo
                 * @param {Object} data - Objeto { type: { id: value } }
                 */
                set: async (data) => {
                    for (const [type, entries] of Object.entries(data)) {
                        for (const [id, value] of Object.entries(entries)) {
                            try {
                                if (value) {
                                    await writeData(sessionId, type, id, value);
                                } else {
                                    await removeData(sessionId, type, id);
                                }
                            } catch (err) {
                                console.error(`[PG Auth] Error writing ${type}/${id}:`, err.message);
                            }
                        }
                    }
                },
            },
        },

        /**
         * Salvar credenciais atualizadas (chamado pelo evento creds.update)
         */
        saveCreds: async () => {
            try {
                await writeData(sessionId, 'creds', '', creds);
            } catch (err) {
                console.error('[PG Auth] Error saving creds:', err.message);
            }
        },
    };
};

module.exports = { usePostgresAuthState, removeSession };
