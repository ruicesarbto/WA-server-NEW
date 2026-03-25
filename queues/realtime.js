/**
 * ============================================================================
 * Real-Time Emitter — Socket.IO Bridge for BullMQ Workers
 * ============================================================================
 * Os Workers rodam fora do contexto do Express/Socket.IO.
 * Este módulo acessa a instância global do Socket.IO (getIOInstance)
 * e emite eventos para o frontend após persistência no PostgreSQL.
 *
 * Eventos emitidos:
 *   - "push_new_msg"           → nova mensagem no chat aberto
 *   - "update_conversations"   → atualiza lista da Inbox
 *   - "update_delivery_status" → mudança de status (sent/delivered/read)
 * ============================================================================
 */

const { getIOInstance } = require('../socket');
const { query } = require('../database/dbpromise');

/**
 * Busca o socket_id do usuário na tabela rooms.
 * Retorna null se o user não está conectado.
 */
async function getUserSocketId(uid) {
    try {
        const rows = await query(`SELECT socket_id FROM rooms WHERE uid = ?`, [uid]);
        return rows[0]?.socket_id || null;
    } catch (err) {
        console.error('[Realtime] Failed to get socket_id for uid:', uid, err.message);
        return null;
    }
}

/**
 * Emite evento de nova mensagem para o frontend via Socket.IO.
 *
 * @param {Object} params
 * @param {string} params.uid - ID do usuário dono da instância
 * @param {string} params.instanceId - ID da sessão Baileys
 * @param {string} params.chatId - ID do chat (jid)
 * @param {Object} params.message - Dados da mensagem persistida
 * @param {Object} params.chatSnapshot - Snapshot atualizado do chat (para Inbox)
 */
async function emitNewMessage({ uid, instanceId, chatId, message, chatSnapshot }) {
    const io = getIOInstance();
    if (!io) return;

    const socketId = await getUserSocketId(uid);
    if (!socketId) return; // User offline, nada a fazer

    // 1. Push da mensagem no chat aberto
    io.to(socketId).emit('push_new_msg', {
        msg: message,
        chatId: chatId,
        sessionId: instanceId,
    });

    // 2. Atualiza a lista de conversas na Inbox
    //    Mapeia o chatSnapshot (colunas PG lowercase) para o formato que o frontend espera.
    if (chatSnapshot) {
        io.to(socketId).emit('update_conversations', {
            chat: {
                id: chatSnapshot.id,
                chat_id: chatSnapshot.chat_id,
                instance_id: chatSnapshot.instance_id || instanceId,
                sender_name: chatSnapshot.sender_name,
                sender_jid: chatSnapshot.sender_jid || chatId,
                profile_image: chatSnapshot.profile_image || null,
                last_message: chatSnapshot.last_message,
                last_message_at: chatSnapshot.last_message_at,
                last_message_type: chatSnapshot.last_message_type,
                unread_count: chatSnapshot.unread_count || 0,
                is_read: chatSnapshot.is_read,
                is_pinned: chatSnapshot.is_pinned || false,
                chat_status: chatSnapshot.chat_status || 'open',
            },
            instanceId: instanceId,
        });
    }
}

/**
 * Emite atualização de status de entrega.
 */
async function emitDeliveryUpdate({ uid, chatId, msgId, status }) {
    const io = getIOInstance();
    if (!io) return;

    const socketId = await getUserSocketId(uid);
    if (!socketId) return;

    io.to(socketId).emit('update_delivery_status', {
        chatId,
        status,
        msgId,
    });
}

module.exports = { emitNewMessage, emitDeliveryUpdate };
