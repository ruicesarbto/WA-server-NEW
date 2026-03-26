const router = require('express').Router();
const { query } = require('../database/dbpromise');
const validateUser = require('../middlewares/user');

/**
 * Busca o histórico de mensagens de um chat específico.
 * Suporta paginação via timestamp ou offset (simplificado aqui para os últimos 50).
 */
router.get('/get_chat_history', validateUser, async (req, res) => {
    try {
        const { chatId, instanceId, limit = 50, timestamp } = req.query;
        const uid = req.decode.uid;

        if (!chatId || !instanceId) {
            return res.json({ success: false, msg: "chatId e instanceId são obrigatórios" });
        }

        let sql = `
            SELECT * FROM messages 
            WHERE uid = ? AND instance_id = ? AND chat_id = ?
        `;
        const params = [uid, instanceId, chatId];

        if (timestamp) {
            sql += ` AND message_timestamp < ?`;
            params.push(timestamp);
        }

        sql += ` ORDER BY message_timestamp DESC LIMIT ?`;
        params.push(parseInt(limit));

        const messages = await query(sql, params);

        // Retornar em ordem cronológica (mais antiga primeiro para o frontend)
        res.json({
            success: true,
            data: messages.reverse()
        });
    } catch (err) {
        console.error('[ChatHistory] Error:', err.message);
        res.json({ success: false, msg: "Erro ao buscar histórico", error: err.message });
    }
});

/**
 * Lista todos os chats do usuário (Fallback para o socket).
 */
router.get('/list', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
        return res.json({ success: false, msg: "userId é obrigatório" });
    }
    // No nosso banco PostgreSQL, a coluna é 'uid'
    const chats = await query('SELECT * FROM chats WHERE uid = ? ORDER BY last_message_at DESC', [userId]);
    res.json(chats);
  } catch (err) {
    console.error('[ChatList:Fallback] Error:', err.message);
    res.json({ success: false, msg: "Erro ao buscar lista de chats", error: err.message });
  }
});

module.exports = router;
