const router = require('express').Router()
const { query } = require('../database/dbpromise.js')
const bcrypt = require('bcryptjs')
const { sign } = require('jsonwebtoken')
const validateUser = require('../middlewares/user.js')
const moment = require('moment')
const { isValidEmail, encodeObject, sendChatTextMessage, deleteFileIfExists, getImageAsBase64, convertTempletObj } = require('../functions/function.js')
const randomstring = require('randomstring')
const reqMiddleware = require('../middlewares/req.js');
const { createSession, sendMessage, getSession, formatPhone, getChatList } = reqMiddleware;
const { fetchPersonStatus, fetchProfileUrl, fetchBusinessprofile, fetchGroupMeta } = require('../functions/control.js')
const { sendTextMsg, sendMedia, sendPollMsg } = require('../functions/x.js')
const mime = require('mime-types');
const { checkPlanExpiry } = require('../middlewares/planValidator.js')
const { cacheGetInbox, cacheWarmInbox } = require('../queues/cache.js')

const PINNED_TABLE_NAME = 'chat_pinned'
let ensurePinnedTablePromise = null

async function ensurePinnedTable() {
    if (!ensurePinnedTablePromise) {
        ensurePinnedTablePromise = query(`
            CREATE TABLE IF NOT EXISTS \`${PINNED_TABLE_NAME}\` (
                id INT(11) NOT NULL AUTO_INCREMENT,
                uid VARCHAR(191) NOT NULL,
                instance_id VARCHAR(191) DEFAULT NULL,
                chat_id VARCHAR(191) DEFAULT NULL,
                sender_jid VARCHAR(191) DEFAULT NULL,
                display_name VARCHAR(191) DEFAULT NULL,
                position INT(11) DEFAULT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uniq_user_chat (uid, instance_id, chat_id, sender_jid)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `).catch((error) => {
            console.error('[PinnedChats] Failed to ensure table:', error)
            // Reset promise so next call can retry
            ensurePinnedTablePromise = null
            throw error
        });
    }
    return ensurePinnedTablePromise
}

// get my chats — Redis Hot Cache first, PostgreSQL fallback
router.get("/get_my_chats", validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { instance } = req.query
        const uid = req.decode.uid

        let selIns

        if (instance) {
            selIns = instance
            // Fire-and-forget: não bloqueia a resposta
            query(`UPDATE "user" SET opened_chat_instance = ? WHERE uid = ?`, [instance, uid]).catch(() => {})
        } else {
            if (req?.user?.opened_chat_instance) {
                selIns = req?.user?.opened_chat_instance
            } else {
                const getInstance = await query(`SELECT * FROM instance WHERE uid = ? LIMIT 1`, [uid])
                const selInsId = getInstance[0]?.instance_id
                selIns = selInsId
                query(`UPDATE "user" SET opened_chat_instance = ? WHERE uid = ?`, [selInsId, uid]).catch(() => {})
            }
        }

        const session = await getSession(selIns)
        if (!session) {
            return res.json({ msg: "Instance not found. Please re add the instance" })
        }

        const userData = session?.authState?.creds?.me || session.user

        // ── 1. Tentar Redis Hot Cache (~0.5ms) ──
        let data = null
        try {
            data = await cacheGetInbox(selIns)
            if (data) {
                console.log(`[Inbox] Cache HIT: ${data.length} chats for ${selIns}`)
            }
        } catch (e) {
            console.error('[Inbox] Cache read failed, falling back to PG:', e.message)
        }

        // ── 2. Cache miss → PostgreSQL (~15-50ms) + warm cache ──
        if (!data) {
            console.log(`[Inbox] Cache MISS for ${selIns}, reading from PG`)
            data = await query(`SELECT * FROM chats WHERE uid = ? AND instance_id = ? ORDER BY last_message_at DESC`, [
                uid,
                selIns
            ])

            // Warm the cache in background (não bloqueia a resposta)
            if (data?.length) {
                cacheWarmInbox(selIns, data).catch(e =>
                    console.error('[Inbox] Cache warm failed:', e.message))
            }
        }

        res.json({ data, success: true, userData: { ...userData, selIns } })

        // ── Bug 3 Fix: Background lazy fill for missing profile_image (cache-aside) ──
        // Non-blocking: runs after response is sent, populates chats without avatars
        ;(async () => {
            try {
                const chatsWithoutAvatar = (data || []).filter(c => !c.profile_image && c.sender_jid);
                if (!chatsWithoutAvatar.length || !session) return;
                const { fetchProfileUrl } = require('../functions/control.js');
                for (const chat of chatsWithoutAvatar.slice(0, 20)) {
                    try {
                        const imgUrl = await fetchProfileUrl(session, chat.sender_jid);
                        if (imgUrl) {
                            await query(
                                `UPDATE chats SET profile_image = $1 WHERE instance_id = $2 AND sender_jid = $3`,
                                [imgUrl, selIns, chat.sender_jid]
                            );
                        }
                    } catch {}
                    await new Promise(r => setTimeout(r, 500)); // throttle: 500ms between requests
                }
                if (chatsWithoutAvatar.length > 0) {
                    console.log(`[Inbox:LazyAvatar] Processed ${Math.min(chatsWithoutAvatar.length, 20)} chats for instance=${selIns}`);
                }
            } catch (lazyErr) {
                console.error('[Inbox:LazyAvatar] Fill failed:', lazyErr.message);
            }
        })();

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

router.post('/get_pinned', validateUser, async (req, res) => {
    try {
        await ensurePinnedTable()

        const instanceId = req.body?.instance || null
        const params = [req.decode.uid]
        let whereClause = 'uid = ?'

        if (instanceId) {
            whereClause += ' AND (instance_id = ? OR instance_id IS NULL)'
            params.push(instanceId)
        }

        const rows = await query(
            `SELECT chat_id, sender_jid, position, instance_id, display_name, created_at
             FROM \`${PINNED_TABLE_NAME}\`
             WHERE ${whereClause}
             ORDER BY 
                CASE WHEN position IS NULL THEN 1 ELSE 0 END,
                position ASC,
                created_at ASC`,
            params
        )

        const data = Array.isArray(rows)
            ? rows
                .map((row, index) => {
                    const fallbackOrder = index
                    const id = row.chat_id || row.sender_jid || null
                    const jid = row.sender_jid || row.chat_id || null
                    if (!id && !jid) {
                        return null
                    }
                    return {
                        id,
                        jid,
                        name: row.display_name || undefined,
                        order: typeof row.position === 'number' ? row.position : fallbackOrder,
                        instance: row.instance_id || instanceId || null,
                        createdAt: row.created_at || null
                    }
                })
                .filter(Boolean)
            : []

        res.json({
            success: true,
            data
        })
    } catch (error) {
        console.error('[PinnedChats] Failed to fetch pinned chats:', error)
        res.status(500).json({
            success: false,
            msg: 'Não foi possível carregar as conversas fixadas.',
            error: error?.message || String(error),
            data: []
        })
    }
})

router.post('/get_pinned', validateUser, async (req, res) => {
    try {
        await ensurePinnedTable()

        const instanceId = req.body?.instance || null
        const params = [req.decode.uid]
        let whereClause = 'uid = ?'

        if (instanceId) {
            whereClause += ' AND (instance_id = ? OR instance_id IS NULL)'
            params.push(instanceId)
        }

        const rows = await query(
            `SELECT chat_id, sender_jid, position, instance_id, display_name, created_at
             FROM \`${PINNED_TABLE_NAME}\`
             WHERE ${whereClause}
             ORDER BY 
                CASE WHEN position IS NULL THEN 1 ELSE 0 END,
                position ASC,
                created_at ASC`,
            params
        )

        const data = Array.isArray(rows)
            ? rows
                .map((row, index) => {
                    const fallbackOrder = index
                    const id = row.chat_id || row.sender_jid || null
                    const jid = row.sender_jid || row.chat_id || null
                    if (!id && !jid) {
                        return null
                    }
                    return {
                        id,
                        jid,
                        name: row.display_name || undefined,
                        order: typeof row.position === 'number' ? row.position : fallbackOrder,
                        instance: row.instance_id || instanceId || null,
                        createdAt: row.created_at || null
                    }
                })
                .filter(Boolean)
            : []

        res.json({
            success: true,
            data
        })
    } catch (error) {
        console.error('[PinnedChats] Failed to fetch pinned chats:', error)
        res.status(500).json({
            success: false,
            msg: 'Não foi possível carregar as conversas fixadas.',
            error: error?.message || String(error),
            data: []
        })
    }
})

module.exports = router

// ── PURGE ALL: apaga todos os chats, msgs e mídias ──
router.post('/purge_all_data', validateUser, async (req, res) => {
    try {
        const uid = req.decode.uid;

        // 1. Truncar tabelas do DB
        await query(`DELETE FROM messages WHERE uid = ?`, [uid]);
        await query(`DELETE FROM chats WHERE uid = ?`, [uid]);

        // 2. Limpar cache Redis
        try {
            const { getRedisClient } = require('../queues/cache.js');
            const redis = getRedisClient?.();
            if (redis) {
                const keys = await redis.keys('inbox:*');
                if (keys.length) await redis.del(...keys);
            }
        } catch {}

        // 3. Limpar mídias locais
        const fs = require('fs');
        const path = require('path');
        const mediaDir = path.join(__dirname, '..', 'public', 'media');
        const dirs = ['avatars', 'images', 'audio', 'video', 'documents', 'stickers'];
        for (const dir of dirs) {
            const fullPath = path.join(mediaDir, dir);
            try {
                if (fs.existsSync(fullPath)) {
                    const files = fs.readdirSync(fullPath);
                    for (const file of files) {
                        fs.unlinkSync(path.join(fullPath, file));
                    }
                }
            } catch {}
        }

        res.json({ success: true, msg: 'Todos os chats, mensagens e mídias foram apagados.' });
    } catch (err) {
        console.error('[purge_all_data]', err);
        res.json({ success: false, msg: 'Erro ao limpar dados', err: err.message });
    }
})


// send text message
router.post('/send_text', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        // Accept both legacy format (text, toJid, toName, chatId, instance)
        // and new frontend format (msg, to, id, chatId, toName)
        const text = req.body.text || req.body.msg
        const toJid = req.body.toJid || req.body.to
        const toName = req.body.toName || ''
        let chatId = req.body.chatId
        const instance = req.body.instance || req.body.id

        if (!text || !toJid || !instance) {
            return res.json({ success: false, msg: "Not enough input provided" })
        }

        // Generate chatId if missing (crucial for New Conversation)
        if (!chatId) {
            const isGroup = toJid.endsWith('@g.us')
            const phone = toJid.split('@')[0]
            chatId = Buffer.from(JSON.stringify({
                ins: instance,
                grp: isGroup,
                num: phone
            })).toString('base64')
        }

        const msgObj = {
            text
        }

        const uid = req.decode.uid

        const saveObj = {
            "group": toJid.endsWith('@g.us'),
            "type": "text",
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)

        const resp = await sendTextMsg({
            uid,
            msgObj,
            toJid,
            saveObj,
            chatId,
            session,
            sessionId: instance
        })

        res.json(resp)

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// send image msg 
router.post('/send_image', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { caption, toJid, toName, chatId, instance, fileName, image } = req.body


        if (!toJid || !toName || !chatId || !instance || !fileName || !image) {
            return res.json({ success: false, msg: "Please select an image" })
        }

        const sendObj = {
            image: {
                url: `${__dirname}/../client/public/media/${image}`
            },
            caption: caption || null,
            fileName,
            jpegThumbnail: getImageAsBase64(`${__dirname}/../client/public/media/${image}`)
        }

        const msgObj = {
            caption: caption || "",
            fileName: image,
            "mimetype": mime.lookup(image)
        }

        const uid = req.decode.uid

        const saveObj = {
            "group": false,
            "type": "image",
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)

        const resp = await sendMedia({
            uid,
            msgObj,
            toJid,
            saveObj,
            chatId,
            session,
            sessionId: instance,
            sendObj
        })

        res.json(resp)

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})


// send video 
router.post('/send_video', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { caption, toJid, toName, chatId, instance, fileName, originalFile } = req.body

        if (!toJid || !toName || !chatId || !instance || !fileName || !originalFile) {
            return res.json({ success: false, msg: "Please select an video" })
        }

        const sendObj = {
            video: {
                url: `${__dirname}/../client/public/media/${fileName}`
            },
            caption: caption || null,
            fileName: originalFile
        }

        const msgObj = {
            caption: caption || "",
            fileName: fileName,
            mimetype: mime.lookup(fileName)
        }

        const uid = req.decode.uid

        const saveObj = {
            "group": false,
            "type": "video",
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)

        console.log({
            sendObj
        })

        const resp = await sendMedia({
            uid,
            msgObj,
            toJid,
            saveObj,
            chatId,
            session,
            sessionId: instance,
            sendObj
        })

        res.json(resp)

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// send doc 
router.post('/send_doc', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { caption, toJid, toName, chatId, instance, fileName, originalFile } = req.body

        if (!toJid || !toName || !chatId || !instance || !fileName || !originalFile) {
            return res.json({ success: false, msg: "Please select an video" })
        }

        const sendObj = {
            document: {
                url: `${__dirname}/../client/public/media/${fileName}`
            },
            caption: caption || null,
            fileName: originalFile
        }

        const msgObj = {
            caption: caption || "",
            fileName: fileName,
            mimetype: mime.lookup(fileName)
        }

        const uid = req.decode.uid

        const saveObj = {
            "group": false,
            "type": "doc",
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)

        const resp = await sendMedia({
            uid,
            msgObj,
            toJid,
            saveObj,
            chatId,
            session,
            sessionId: instance,
            sendObj
        })

        res.json(resp)

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// send audio 
router.post('/send_aud', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { toJid, toName, chatId, instance, fileName, originalFile } = req.body

        if (!toJid || !toName || !chatId || !instance || !fileName || !originalFile) {
            return res.json({ success: false, msg: "Please select an video" })
        }

        const sendObj = {
            audio: {
                url: `${__dirname}/../client/public/media/${fileName}`
            },
            fileName: originalFile,
            ptt: true
        }

        const msgObj = {
            caption: "",
            fileName: fileName,
            mimetype: mime.lookup(fileName)
        }

        const uid = req.decode.uid

        const saveObj = {
            "group": false,
            "type": "aud",
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)

        const resp = await sendMedia({
            uid,
            msgObj,
            toJid,
            saveObj,
            chatId,
            session,
            sessionId: instance,
            sendObj
        })

        res.json(resp)

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// send location 
router.post('/send_loc', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { toJid, toName, chatId, instance, lat, long } = req.body

        if (!toJid || !toName || !chatId || !instance || !lat || !long) {
            return res.json({ success: false, msg: "Please write all fields" })
        }

        const sendObj = {
            location: { degreesLatitude: lat, degreesLongitude: long }
        }

        const msgObj = {
            lat: lat,
            long: long,
            "name": "",
            "address": ""
        }

        const uid = req.decode.uid

        const saveObj = {
            "group": false,
            "type": "loc",
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)

        const resp = await sendMedia({
            uid,
            msgObj,
            toJid,
            saveObj,
            chatId,
            session,
            sessionId: instance,
            sendObj
        })

        res.json(resp)

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})


// send poll message 
router.post('/send_poll', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { toJid, toName, chatId, instance, name, values } = req.body

        if (!toJid || !toName || !chatId || !instance) {
            return res.json({ success: false, msg: "Invalid request" })
        }

        if (!name || values?.length < 1) {
            return res.json({ msg: "Please give a poll title and poll option(s)" })
        }

        if (values.length < 2) {
            return res.json({ msg: "At least 2 options are reuired" })
        }

        const msgObj = {
            poll: {
                name: name?.slice(0, 230),
                values: values,
                selectableCount: 1
            }
        }

        const uid = req.decode.uid

        const saveObj = {
            "group": false,
            "type": "poll",
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)


        const resp = await sendTextMsg({
            uid,
            msgObj,
            toJid,
            saveObj,
            chatId,
            session,
            sessionId: instance,
        })

        res.json(resp)

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})


// del chat 
router.post('/del_chat', validateUser, async (req, res) => {
    try {
        const { chatId } = req.body

        if (!chatId) {
            return res.json({ msg: "Please provide chat id" })
        }

        await query(`DELETE FROM chats WHERE chat_id = ?`, [
            chatId
        ])

        const filePath = `${__dirname}/../conversations/inbox/${req.decode.uid}/${chatId}.json`
        deleteFileIfExists(filePath)

        res.json({
            msg: "Chat was deleted",
            success: true
        })

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// getting sender details 
router.post('/get_sender_details', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { sessionId, jid } = req.body

        if (!sessionId || !jid) {
            return res.json({
                msg: "Invalid request"
            })
        }

        const session = await getSession(sessionId)

        if (!session) {
            return res.json({
                msg: "This session is busy could not fetch the details"
            })
        }

        const status = await fetchPersonStatus(session, jid)
        const profilePhoto = await fetchProfileUrl(session, jid)
        // const pro = await fetchBusinessprofile(session, jid)

        res.json({
            success: true,
            status: status,
            profilePhoto: profilePhoto,
            // pro: pro
        })

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// get group meta data info 
router.post('/get_group_meta', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { sessionId, jid } = req.body

        if (!sessionId || !jid) {
            return res.json({
                msg: "Invalid request"
            })
        }

        const session = await getSession(sessionId)

        if (!session) {
            return res.json({
                msg: "This session is busy could not fetch the details"
            })
        }

        const groupData = await fetchGroupMeta(session, jid)
        const profilePhoto = await fetchProfileUrl(session, jid)

        res.json({
            success: true, profilePhoto, groupData
        })

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// get chat note 
router.post("/get_chat_note", validateUser, async (req, res) => {
    try {
        const getChat = await query(`SELECT * FROM chats WHERE chat_id = ? AND uid = ?`, [
            req.body.chatId,
            req.decode.uid
        ])

        res.json({
            success: true,
            data: getChat[0]?.chat_note || ""
        })

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// get chat note 
router.post('/update_chat_note', validateUser, async (req, res) => {
    try {
        const { chatId, note } = req.body
        await query(`UPDATE chats SET chat_note = ? WHERE chat_id = ? AND uid = ?`, [
            note,
            chatId,
            req.decode.uid
        ])

        res.json({
            success: true,
            msg: "Note updated"
        })

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// get msg Votes 
router.post('/get_poll_votes', validateUser, async (req, res) => {
    try {
        const { msgId } = req.body
        const data = await query(`SELECT * FROM poll_votes WHERE msg_id = ? AND uid = ?`, [
            msgId,
            req.decode.uid
        ])

        res.json({
            data,
            success: true
        })

    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

// send templet 
router.post('/send_templet', validateUser, checkPlanExpiry, async (req, res) => {
    try {
        const { id, toJid, toName, chatId, instance } = req.body


        if (!toJid || !toName || !chatId || !instance) {
            return res.json({ success: false, msg: "Not enough input provided" })
        }

        const getTemplet = await query(`SELECT * FROM templet WHERE id = ? AND uid = ?`, [id, req.decode.uid])

        if (getTemplet.length < 1) {
            return res.json({ msg: "Templet not found" })
        }

        const templetContet = JSON.parse(getTemplet[0]?.content)
        const templetType = getTemplet[0]?.type


        // const msgObj = templetContet
        const { sendObj, msgObj, type } = await convertTempletObj(templetContet, templetType)


        console.log({
            type,
            sendObj
        })

        const uid = req.decode.uid

        const saveObj = {
            "group": false,
            "type": templetType?.toLowerCase(),
            "msgId": "",
            "remoteJid": toJid,
            "msgContext": msgObj,
            "reaction": "",
            "timestamp": "",
            "senderName": toName,
            "status": "sent",
            "star": false,
            "route": "outgoing",
            "context": ""
        }

        const session = await getSession(instance)

        if (templetType === "text" || templetType === "poll" || templetType === "loc") {
            const resp = await sendTextMsg({
                uid,
                msgObj,
                toJid,
                saveObj,
                chatId,
                session,
                sessionId: instance
            })
            res.json(resp)
        } else {

            const resp = await sendMedia({
                uid,
                msgObj,
                toJid,
                saveObj,
                chatId,
                session,
                sessionId: instance,
                sendObj
            })
            res.json(resp)
        }


    } catch (err) {
        res.json({ success: false, msg: "something went wrong", err })
        console.log(err)
    }
})

router.post('/get_pinned', validateUser, async (req, res) => {
    try {
        await ensurePinnedTable();

        const instanceId = req.body?.instance || null;
        const params = [req.decode.uid];
        let whereClause = 'uid = ?';

        if (instanceId) {
            whereClause += ' AND (instance_id = ? OR instance_id IS NULL)';
            params.push(instanceId);
        }

        const rows = await query(
            `SELECT chat_id, sender_jid, position, instance_id, display_name
             FROM \`${PINNED_TABLE_NAME}\`
             WHERE ${whereClause}
             ORDER BY 
                CASE WHEN position IS NULL THEN 1 ELSE 0 END,
                position ASC,
                created_at ASC`,
            params
        );

        const data = Array.isArray(rows)
            ? rows
                .map((row, index) => {
                    const fallbackOrder = index;
                    const id = row.chat_id || row.sender_jid || null;
                    const jid = row.sender_jid || row.chat_id || null;
                    if (!id && !jid) {
                        return null;
                    }
                    return {
                        id,
                        jid,
                        name: row.display_name || undefined,
                        order: typeof row.position === 'number' ? row.position : fallbackOrder,
                        instance: row.instance_id || instanceId || null,
                    };
                })
                .filter(Boolean)
            : [];

        res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('[PinnedChats] Failed to fetch pinned chats:', error);
        res.status(500).json({
            success: false,
            msg: 'Não foi possível carregar as conversas fixadas.',
            error: error?.message || String(error),
            data: [],
        });
    }
});

router.post('/get_pinned', validateUser, async (req, res) => {
    try {
        await ensurePinnedTable()

        const instanceId = req.body?.instance || null
        const params = [req.decode.uid]
        let whereClause = 'uid = ?'

        if (instanceId) {
            whereClause += ' AND (instance_id = ? OR instance_id IS NULL)'
            params.push(instanceId)
        }

        const rows = await query(
            `SELECT chat_id, sender_jid, position, instance_id, display_name, created_at
             FROM \`${PINNED_TABLE_NAME}\`
             WHERE ${whereClause}
             ORDER BY 
                CASE WHEN position IS NULL THEN 1 ELSE 0 END,
                position ASC,
                created_at ASC`,
            params
        )

        const data = Array.isArray(rows)
            ? rows
                .map((row, index) => {
                    const fallbackOrder = index
                    const id = row.chat_id || row.sender_jid || null
                    const jid = row.sender_jid || row.chat_id || null
                    if (!id && !jid) {
                        return null
                    }
                    return {
                        id,
                        jid,
                        name: row.display_name || undefined,
                        order: typeof row.position === 'number' ? row.position : fallbackOrder,
                        instance: row.instance_id || instanceId || null,
                        createdAt: row.created_at || null
                    }
                })
                .filter(Boolean)
            : []

        res.json({
            success: true,
            data
        })
    } catch (error) {
        console.error('[PinnedChats] Failed to fetch pinned chats:', error)
        res.status(500).json({
            success: false,
            msg: 'Não foi possível carregar as conversas fixadas.',
            error: error?.message || String(error),
            data: []
        })
    }
})
