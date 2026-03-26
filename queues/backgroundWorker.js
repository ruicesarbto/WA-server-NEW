/**
 * ============================================================================
 * BullMQ Background Worker — Processador de Tarefas Recorrentes
 * ============================================================================
 * Processa jobs da queue_background_tasks (Broadcast e Warmer).
 * Substitui os loops baseados em setTimeout/while(true).
 * ============================================================================
 */

const { Worker } = require('bullmq');
const { getRedisConnection } = require('./connection');
const { query } = require('../database/dbpromise');
const moment = require("moment-timezone");

// ---------------------------------------------------------------------------
// Helpers (Extraídos de loops/broadcastLoop.js e loops/warmerLoop.js)
// ---------------------------------------------------------------------------

function getRandomElementFromArray(array, exclude) {
    const filteredArray = array.filter((item) => item !== exclude);
    if (filteredArray.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * filteredArray.length);
    return filteredArray[randomIndex];
}

function hasDatePassedInTimezone(timezone, datetimeFromMySQL) {
    if (!timezone || !datetimeFromMySQL) return true;
    const momentDate = moment.utc(datetimeFromMySQL).tz(timezone);
    if (!momentDate.isValid()) return false;
    const currentMoment = moment.tz(timezone);
    return momentDate.isBefore(currentMoment);
}

function formatWhatsAppNumber(number) {
    const cleanedNumber = number.replace(/\D/g, "");
    return `${cleanedNumber}@s.whatsapp.net`;
}

// ---------------------------------------------------------------------------
// Broadcast Logic
// ---------------------------------------------------------------------------

async function processBroadcast() {
    console.log('[BackgroundWorker] Running Broadcast cycle...');
    const pending = await query(`SELECT * FROM broadcast WHERE status = ?`, ["PENDING"]);
    
    const due = pending.filter(i => i.schedule && hasDatePassedInTimezone(i?.timezone, i?.schedule));
    
    for (const batch of due) {
        const logs = await query(
            `SELECT * FROM broadcast_log WHERE broadcast_id = ? AND delivery_status = ? LIMIT 10`,
            [batch.broadcast_id, "PENDING"]
        );

        if (logs.length === 0) {
            await query(`UPDATE broadcast SET status = ? WHERE broadcast_id = ?`, ["COMPLETED", batch.broadcast_id]);
            continue;
        }

        const { getSession } = require("../middlewares/req");
        const { mergeVariables } = require("../functions/function");

        for (const logObj of logs) {
            try {
                const insArr = JSON.parse(batch.instance_id);
                const instanceId = getRandomElementFromArray(insArr);
                const jid = formatWhatsAppNumber(logObj.send_to);
                const templet = JSON.parse(batch.templet);

                const session = await getSession(instanceId);
                if (!session) continue;

                // Validar se o número existe no WhatsApp (Baileys nativo)
                const [result] = await session.onWhatsApp(jid);
                if (!result || !result.exists) {
                    await query(`UPDATE broadcast_log SET delivery_status = ? WHERE id = ?`, ["Number NA", logObj.id]);
                    continue;
                }

                // Lógica simplificada de resolução de template (pode ser expandida)
                const text = templet.type === 'text' ? JSON.parse(templet.content) : 'Media Message';
                
                const finalMsg = mergeVariables({
                    content: { text: typeof text === 'string' ? text : (text.text || '') },
                    varJson: JSON.parse(logObj.contact),
                    type: 'text'
                });

                const sent = await session.sendMessage(jid, finalMsg);
                if (sent?.key?.id) {
                    await query(
                        `UPDATE broadcast_log SET delivery_status = ?, msg_id = ?, instance_id = ? WHERE id = ?`,
                        ["sent", sent.key.id, instanceId, logObj.id]
                    );
                }
            } catch (err) {
                console.error(`[BackgroundWorker:Broadcast] Error at log ${logObj.id}:`, err.message);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Warmer Logic
// ---------------------------------------------------------------------------

async function processWarmer() {
    console.log('[BackgroundWorker] Running Warmer cycle...');
    const activeWarmers = await query(`SELECT * FROM warmers WHERE is_active = ?`, [1]);
    
    for (const warmer of activeWarmers) {
        try {
            const instanceArr = JSON.parse(warmer.instances);
            if (instanceArr.length < 2) continue;

            const scripts = await query(`SELECT * FROM warmer_script WHERE uid = ?`, [warmer.uid]);
            if (scripts.length === 0) continue;

            const fromInst = getRandomElementFromArray(instanceArr);
            const toInst = getRandomElementFromArray(instanceArr, fromInst);
            const script = getRandomElementFromArray(scripts);

            const toObj = await query(`SELECT jid FROM instance WHERE instance_id = ?`, [toInst]);
            if (!toObj[0]?.jid) continue;

            const { getSession } = require("../middlewares/req");
            const session = await getSession(fromInst);
            if (!session) continue;

            const jid = `${toObj[0].jid}@s.whatsapp.net`;
            await session.sendMessage(jid, { text: script.message });
            console.log(`[BackgroundWorker:Warmer] Message sent from ${fromInst} to ${toInst}`);
        } catch (err) {
            console.error(`[BackgroundWorker:Warmer] Error for UID ${warmer.uid}:`, err.message);
        }
    }
}

// ---------------------------------------------------------------------------
// Worker Definition
// ---------------------------------------------------------------------------

const backgroundWorker = new Worker('queue_background_tasks', async (job) => {
    const { type } = job.data;
    
    if (type === 'broadcast') {
        await processBroadcast();
    } else if (type === 'warmer') {
        await processWarmer();
    }
}, {
    connection: getRedisConnection(),
    concurrency: 1, // Um ciclo por vez
});

backgroundWorker.on('failed', (job, err) => {
    console.error(`[BackgroundWorker] Job ${job.id} failed:`, err.message);
});

module.exports = backgroundWorker;
