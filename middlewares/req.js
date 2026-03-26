const { existsSync, unlinkSync, readdir } = require("fs");
const { join } = require("path");
const pino = require("pino");

// Auth state: PostgreSQL (producao)
// O metodo file (useMultiFileAuthState) foi desativado - gerava dezenas de .json no servidor
// Agora todo o estado de autenticacao Baileys fica no PostgreSQL (tabela baileys_auth)
const { usePostgresAuthState, removeSession: removeSessionFromDB } = require("../database/usePostgresAuthState");
console.log("[Auth] Using PostgreSQL-based auth state (production mode)");

// Baileys variables - will be initialized dynamically
let makeWASocket;
let Browsers,
  DisconnectReason,
  delay,
  // useMultiFileAuthState, // DESATIVADO - substituido por usePostgresAuthState
  getAggregateVotesInPollMessage,
  downloadMediaMessage,
  getUrlInfo,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion;

// Initialize Baileys
const initBaileys = async () => {
  try {
    const baileys = await import("baileys");
    makeWASocket = baileys.default;
    ({
      Browsers,
      DisconnectReason,
      delay,
      // useMultiFileAuthState, // DESATIVADO - substituido por usePostgresAuthState
      getAggregateVotesInPollMessage,
      downloadMediaMessage,
      getUrlInfo,
      makeCacheableSignalKeyStore,
      fetchLatestBaileysVersion,
      jidNormalizedUser,
    } = baileys);
    console.log("Baileys initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Baileys:", error);
    throw error;
  }
};

const { toDataURL } = require("qrcode");
const dirName = require("../dirname.js");
const response = require("../response.js");
const fs = require("fs");
const path = require("path");
const { query } = require("../database/dbpromise.js");
const { dispatchColdStart, dispatchHotPath } = require("../queues/producers.js");
const { getCacheClient, K } = require("../queues/cache.js");

const sessions = new Map();
const retries = new Map();
const qrGeneratedSessions = new Set(); // Track sessions that have generated QR

const sessionsDir = (sessionId = "") => {
  return join(dirName, "sessions", sessionId ? `${sessionId}.json` : "");
};

const isSessionExists = (sessionId) => {
  return sessions.has(sessionId);
};

const isSessionFileExists = (name) => {
  return existsSync(sessionsDir(name));
};

exports.getSession = (sessionId) => {
  return sessions.get(sessionId) ?? null;
};

// Moving functions up and exporting them immediately
exports.isSessionExists = isSessionExists;
exports.isSessionFileExists = isSessionFileExists;
exports.sessions = sessions;

const {
  decodeObject,
  deleteFileIfExists,
} = require("../functions/function.js");
const { webhookIncoming, updateDelivery } = require("../functions/x.js");
const { chatbotInit } = require("../loops/chatBot.js");

const shouldReconnect = (sessionId) => {
  let maxRetries = parseInt(5);
  let attempts = retries.get(sessionId) ?? 0;

  maxRetries = maxRetries < 1 ? 1 : maxRetries;

  if (attempts < maxRetries) {
    ++attempts;

    console.log("Reconnecting...", { attempts, sessionId });
    retries.set(sessionId, attempts);

    return true;
  }
  return false;
};

exports.createSession = async (
  sessionId,
  isLegacy = false,
  req,
  res,
  getPairCode,
  syncMax = false
) => {
  // Ensure Baileys is initialized
  if (!makeWASocket) {
    await initBaileys();
  }

  const sessionFile = "md_" + sessionId;
  const logger = pino({ level: "silent" });

  // Get latest Baileys version
  const { error, version } = await fetchLatestBaileysVersion();
  if (error) {
    console.log(`Session: ${sessionId} | No connection, check your internet.`);
  }

  // Auth state via PostgreSQL (tabela baileys_auth)
  // DESATIVADO: const { state, saveCreds } = await useMultiFileAuthState(sessionsDir(sessionFile));
  const { state, saveCreds } = await usePostgresAuthState(sessionId);

  /**
   * @type {import('@whiskeysockets/baileys').CommonSocketConfig}
   */
  const waConfig = {
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    version,
    printQRInTerminal: false,
    logger,
    browser: [process.env.APP_NAME || "ScoreChat", "Chrome", "1.0.0"],
    defaultQueryTimeoutMs: 60000,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 10000,
    generateHighQualityLinkPreview: true,
    patchMessageBeforeSending: (message) => {
      const requiresPatch = !!(
        message.buttonsMessage ||
        message.templateMessage ||
        message.listMessage
      );
      if (requiresPatch) {
        message = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadataVersion: 2,
                deviceListMetadata: {},
              },
              ...message,
            },
          },
        };
      }

      return message;
    },
    syncFullHistory: syncMax || false,
  };

  /**
   * @type {import('@whiskeysockets/baileys').AnyWASocket}
   */
  const wa = makeWASocket(waConfig);

  sessions.set(sessionId, { ...wa, isLegacy });

  wa.ev.on("creds.update", saveCreds);

  // Presence observer: emit online/digitando via Socket.IO (somente observação)
  try {
    const { getIOInstance } = require("../socket.js");
    wa.ev.on("presence.update", async ({ id, presences }) => {
      try {
        if (!id || !presences) return;
        const io = getIOInstance && getIOInstance();
        if (!io) return;

        const users = await query(`SELECT uid FROM user WHERE opened_chat_instance = ?`, [sessionId]);
        if (!users?.length) return;

        for (const [participantJid, p] of Object.entries(presences)) {
          const presence = p?.lastKnownPresence; // 'available','unavailable','composing','recording','paused'
          const isTyping = presence === 'composing';
          const online = presence === 'available';

          for (const u of users) {
            const rows = await query(`SELECT socket_id FROM rooms WHERE uid = ?`, [u.uid]);
            const socketId = rows?.[0]?.socket_id;
            if (!socketId) continue;
            io.to(socketId).emit('user:typing', { chatId: id, userId: participantJid, isTyping });
            io.to(socketId).emit('session:status', { chatId: id, userId: participantJid, online });
          }
        }
      } catch (err) {
        console.log('presence.update emit error', err);
      }
    });
  } catch (e) {
    console.log('presence observer init error', e);
  }

  wa.ev.on("chats.set", ({ chats }) => {
    const datNow = Date.now();
    saveDataToFile(chats, `${datNow}-chats.json`);
  });

  // ── Handler: Atualização de Status de Mensagem (Ticks) ──
  async function handleMessageStatusUpdate(message, instanceId) {
    const { cacheUpdateMessageStatus } = require('../queues/cache.js');
    const { getIOInstance } = require('../socket.js');

    const msgId    = message?.key?.id;
    const chatId   = message?.key?.remoteJid;
    const rawStatus = message?.update?.status;

    // Mapeamento: número Baileys → enum do sistema
    const STATUS_MAP = {
      0: 'error',
      1: 'sent',
      2: 'server_ack',
      3: 'delivered',
      4: 'read',
      5: 'played',
    };
    const statusStr = STATUS_MAP[rawStatus] ?? 'sent';

    console.log(`[StatusUpdate] msg=${msgId} chat=${chatId} status=${rawStatus}→${statusStr}`);

    // 1. Atualiza no PostgreSQL
    try {
      await query(
        `UPDATE messages SET status = $1 WHERE instance_id = $2 AND msg_id = $3`,
        [statusStr, instanceId, msgId]
      );
    } catch (err) {
      console.error('[StatusUpdate:PG] Error updating status:', err.message);
    }

    // 2. Atualiza no Redis Hot Cache (fire-and-forget)
    cacheUpdateMessageStatus(instanceId, chatId, msgId, statusStr).catch(() => {});

    // 3. Emite Socket.IO para o frontend
    try {
      const io = getIOInstance();
      if (io) {
        const usersWatching = await query(
          `SELECT uid FROM user WHERE opened_chat_instance = $1`,
          [instanceId]
        );
        for (const u of (usersWatching || [])) {
          const rows = await query(`SELECT socket_id FROM rooms WHERE uid = $1`, [u.uid]);
          const socketId = rows?.[0]?.socket_id;
          if (socketId) {
            io.to(socketId).emit('message:status_update', {
              instanceId,
              chatId,
              msgId,
              status: statusStr,
            });
          }
        }
      }
    } catch (err) {
      console.error('[StatusUpdate:Socket] Error emitting event:', err.message);
    }
  }

  function saveContacts(contacts) {
    const savedContacts = [];

    contacts.forEach((contact) => {
      const savedContact = {
        id: contact.id,
        name: contact.notify ? contact.notify : "NA",
      };
      savedContacts.push(savedContact);
    });

    return savedContacts;
  }

  function createJsonFile(filename, data) {
    const dirName = path.join(process.cwd(), "contacts");
    const filePath = path.join(dirName, `${filename}.json`);
    const jsonData = JSON.stringify(data, null, 2);

    // Ensure the directory exists, create it if not
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }

    // Check if the file already exists
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, jsonData);
      console.log(`${filename}.json file created successfully.`);
    } else {
      console.log(`${filename}.json file already exists, skipping creation.`);
    }
  }

  // Function to save data to a local file
  function saveDataToFile(data, filename) {
    // Convert the data to a JSON string
    const jsonData = JSON.stringify(data, null, 2);

    // Write the JSON data to the file
    fs.writeFileSync(filename, jsonData, "utf8", (err) => {
      if (err) {
        console.error(`Error writing to ${filename}: ${err}`);
      } else {
        console.log(`Data saved to ${filename}`);
      }
    });
  }

  // Helper: try to fetch and save own avatar to DB (with retry and local cache)
  async function trySaveOwnAvatar() {
    try {
      const rawJid = wa.user?.id;
      if (!rawJid) return;
      const myJid = rawJid.split(':')[0] + '@s.whatsapp.net';
      const { fetchProfileUrl } = require("../functions/control.js");
      const { downloadAndSaveAvatar } = require("../functions/avatar.js");
      
      let imgUrl = await fetchProfileUrl(wa, myJid);
      // Retry once after 5s if first attempt failed (WhatsApp rate limiting)
      if (!imgUrl) {
        await new Promise(r => setTimeout(r, 5000));
        imgUrl = await fetchProfileUrl(wa, myJid);
      }
      
      if (!imgUrl) return;

      // [FIX] Salva localmente para evitar expiração da URL do CDN
      const localPath = await downloadAndSaveAvatar(imgUrl, myJid);
      const savedPath = localPath || imgUrl; // Fallback para URL se download falhar

      const creds = wa?.authState?.creds;
      const name = creds?.me?.name || null;
      const userData = JSON.stringify({ id: rawJid, name, imgUrl: savedPath });
      
      await query(
        `UPDATE instance SET userData = ? WHERE instance_id = ?`,
        [userData, sessionId]
      );
      console.log(`Own avatar saved locally for session ${sessionId}: ${savedPath}`);
    } catch (_) { /* non-fatal */ }
  }

  wa.ev.on("messaging-history.set", async (data) => {
    const { uid } = decodeObject(sessionId);

    // ── 1. Despacha para fila BullMQ (zero I/O de banco nesta thread) ──
    // O payload é fatiado em chunks e enviado para Redis.
    // O ColdStartWorker consome e persiste no PostgreSQL com concurrency controlada.
    dispatchColdStart(data, sessionId, uid).catch((err) => {
      console.error(`[ColdStartProducer] FATAL instance=${sessionId}:`, err.message);
    });

    // ── 2. Contatos (preserva lógica legada de arquivo JSON) ──
    const contactData = data.contacts;
    const filteredContacts = (contactData || []).filter((item) =>
      item.id?.endsWith("@s.whatsapp.net")
    );

    if (filteredContacts.length > 0) {
      createJsonFile(`${sessionId}__two`, saveContacts(filteredContacts), uid);
    }

    // ── 3. Avatar próprio ──
    const myRawJid = wa.user?.id;
    if (myRawJid) {
      const myJid = myRawJid.split(':')[0] + '@s.whatsapp.net';
      const self = filteredContacts.find(c => c.id === myJid);
      if (self?.imgUrl) {
        try {
          const creds = wa?.authState?.creds;
          const userData = JSON.stringify({ id: myRawJid, name: creds?.me?.name || null, imgUrl: self.imgUrl });
          await query(`UPDATE instance SET userData = ? WHERE instance_id = ?`, [userData, sessionId]);
          console.log(`Own avatar from history sync for ${sessionId}`);
        } catch (_) {}
      } else {
        await trySaveOwnAvatar();
      }
    }
  });

  wa.ev.on("labels.association", (data) => {
    console.log({ labelData: JSON.stringify(data) });
  });

  wa.ev.on("contacts.upsert", async (data) => {
    const { uid } = decodeObject(sessionId);
    createJsonFile(`${sessionId}__one`, data, uid);

    // Check if own JID is in the upserted contacts
    const myRawJid = wa.user?.id;
    if (myRawJid) {
      const myJid = myRawJid.split(':')[0] + '@s.whatsapp.net';
      const self = data.find(c => c.id === myJid);
      if (self) {
        await trySaveOwnAvatar();
      }
    }

    // ── Bug 3 Fix: Batch avatar fetch for contacts (throttled, cached locally) ──
    (async () => {
      try {
        const { fetchProfileUrl } = require("../functions/control.js");
        const { downloadAndSaveAvatar } = require("../functions/avatar.js");
        const contacts = data.filter(c => c.id?.endsWith('@s.whatsapp.net') || c.id?.endsWith('@g.us'));
        
        for (const contact of contacts.slice(0, 30)) { // Reduzi para 30 para ser mais conservador com rate limit
          try {
            const imgUrl = await fetchProfileUrl(wa, contact.id);
            if (imgUrl) {
              // [FIX] Salva localmente para persistência
              const localPath = await downloadAndSaveAvatar(imgUrl, contact.id);
              const savedPath = localPath || imgUrl;

              await query(
                `UPDATE chats SET profile_image = $1 WHERE instance_id = $2 AND sender_jid = $3`,
                [savedPath, sessionId, contact.id]
              );
            }
          } catch {}
          await new Promise(r => setTimeout(r, 1000)); // throttle aumentado para 1s
        }
        console.log(`[Contacts:Avatar] Batch fetch & cache completed for ${contacts.slice(0, 30).length} contacts (instance=${sessionId})`);
      } catch (batchErr) {
        console.error('[Contacts:Avatar] Batch fetch failed:', batchErr.message);
      }
    })();
  });

  wa.ev.on("messages.update", async (m) => {
    for (const message of m) {
      if (message?.update?.pollUpdates?.length > 0) {
        const pollMessage = getAggregateVotesInPollMessage({
          message: message,
          pollUpdates: message?.update?.pollUpdates,
        });
        updateDelivery(message, sessionId, pollMessage);
        const session = await exports.getSession(sessionId);
        chatbotInit({ messages: m }, wa, sessionId, session, pollMessage);
        continue;
      }

      // ── Atualização de status (ticks) ──
      if (
        message?.update?.status !== undefined &&
        message?.key?.remoteJid &&
        message?.key?.remoteJid !== "status@broadcast" &&
        message?.key?.id
      ) {
        handleMessageStatusUpdate(message, sessionId).catch((err) => {
          console.error('[StatusUpdate] Error:', err.message);
        });
      }
    }
  });

  function saveFile(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  }

  // Automatically read incoming messages — DUAL PATH (Fast + Safe)
  wa.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
    if (!message?.key?.remoteJid || message.key.remoteJid === "status@broadcast") return;
    if (m.type !== "notify") return;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASSO 1: NORMALIZAÇÃO (obrigatória, sempre primeiro)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    message.key.remoteJid = jidNormalizedUser(message.key.remoteJid);
    if (message.key.participant) {
      message.key.participant = jidNormalizedUser(message.key.participant);
    }

    const { uid } = decodeObject(sessionId);
    const chatId = message.key.remoteJid;
    const isGroup = chatId.endsWith("@g.us");
    const fromMe = message.key.fromMe || false;

    // Extrair corpo da mensagem
    const msgContent = message.message || {};
    const msgBody =
      msgContent.conversation ||
      msgContent.extendedTextMessage?.text ||
      msgContent.imageMessage?.caption ||
      msgContent.videoMessage?.caption ||
      msgContent.documentMessage?.caption ||
      "";

    // Tipo de mensagem
    let msgType = "text";
    if (msgContent.imageMessage) msgType = "image";
    else if (msgContent.videoMessage) msgType = "video";
    else if (msgContent.audioMessage) msgType = "audio";
    else if (msgContent.documentMessage) msgType = "document";
    else if (msgContent.stickerMessage) msgType = "sticker";
    else if (msgContent.contactMessage || msgContent.contactsArrayMessage) msgType = "contact";
    else if (msgContent.locationMessage || msgContent.liveLocationMessage) msgType = "location";
    else if (msgContent.reactionMessage) msgType = "reaction";

    // Timestamp
    const rawTs = message.messageTimestamp;
    const epochSec = rawTs
      ? (typeof rawTs === "object" ? rawTs.low : Number(rawTs))
      : Math.floor(Date.now() / 1000);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASSO 2: ENRIQUECIMENTO (nome grupo + avatar — antes do emit)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let senderName = message.pushName || "Sem nome";
    let chatName = senderName;
    let profileImage = null;

    try {
      if (isGroup) {
        // Buscar nome real do grupo (NUNCA o pushName do remetente)
        try {
          const meta = await wa.groupMetadata(chatId);
          chatName = meta?.subject || chatId;
        } catch { chatName = chatId; }
      } else if (fromMe) {
        // Se a mensagem partiu de mim em chat privado, o nome do chat é o JID (contato)
        // O frontend resolverá o nome real via fetchChats ou whatsappStore
        chatName = chatId;
      }

      // Buscar avatar (non-blocking, fallback = null)
      try {
        profileImage = await wa.profilePictureUrl(chatId, "image");
      } catch { profileImage = null; }
    } catch (enrichErr) {
      console.error("[FastPath:Enrich] Error:", enrichErr.message);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASSO 3: 🔥 FAST PATH — EMIT IMEDIATO (UI recebe instantâneo)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      const { getIOInstance } = require("../socket.js");
      const io = getIOInstance();
      if (io) {
        const rows = await query(`SELECT socket_id FROM rooms WHERE uid = ?`, [uid]);
        const socketId = rows?.[0]?.socket_id;
        if (socketId) {
          // Formato compatível com o que o frontend page.tsx e chatEngine.ts esperam
          io.to(socketId).emit("push_new_msg", {
            msg: {
              msgId: message.key.id,
              remoteJid: chatId,
              chatId: chatId,
              type: msgType,
              msgContext: { text: msgBody },
              text: msgBody,
              senderName: senderName,
              senderJid: fromMe ? null : (message.key.participant || chatId),
              fromMe: fromMe,
              route: fromMe ? "outgoing" : "incoming",
              status: "sent",
              timestamp: epochSec,
              pushName: senderName,
              instanceName: sessionId,
              profileImage: profileImage,
            },
            chatId: chatId,
            sessionId: sessionId,
          });

          // Também emite update_conversations para a Inbox atualizar a lista
          io.to(socketId).emit("update_conversations", {
            chat: {
              chat_id: chatId,
              instance_id: sessionId,
              sender_name: chatName,
              sender_jid: chatId,
              profile_image: profileImage,
              last_message: isGroup ? `${senderName}: ${msgBody}` : msgBody,
              last_message_at: new Date(epochSec * 1000).toISOString(),
              last_message_type: msgType,
              unread_count: fromMe ? 0 : 1,
              is_read: fromMe,
              chat_status: "open",
            },
            instanceId: sessionId,
          });

          console.log(`[FastPath] Emitted push_new_msg + update_conversations for ${chatId} (${isGroup ? "group" : "private"})`);
        }
      }
    } catch (emitErr) {
      console.error("[FastPath] Emit error:", emitErr.message);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASSO 4: 🧠 SAFE PATH — BullMQ (persistência assíncrona)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    dispatchHotPath(m.messages, sessionId, uid).catch((err) => {
      console.error(`[SafePath] Dispatch failed instance=${sessionId}:`, err.message);
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASSO 5: Chatbot + Webhook (inalterados)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!fromMe) {
      const session = await exports.getSession(sessionId);
      chatbotInit(m, wa, sessionId, session);
    }

    const session = await exports.getSession(sessionId);
    webhookIncoming(message, sessionId, session);
  });

  wa.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    const statusCode = lastDisconnect?.error?.output?.statusCode;

    console.log("Connection update:", {
      connection,
      statusCode,
      hasQr: !!qr,
      sessionId,
    });

    // Handle successful connection
    if (connection === "open") {
      retries.delete(sessionId);
      qrGeneratedSessions.delete(sessionId);
      console.log(`Session ${sessionId} connected successfully!`);

      const creds = wa?.authState?.creds;
      const rawJid = creds?.me?.id || null;
      const name   = creds?.me?.name || null;
      const jid = rawJid ? jidNormalizedUser(rawJid) : null;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔥 FAST PATH: Emit session:connected IMEDIATAMENTE
      //    (Fecha o modal QR no frontend instantaneamente)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      try {
        const { getIOInstance } = require("../socket.js");
        const io = getIOInstance();
        if (io) {
          const { uid } = decodeObject(sessionId);
          const rows = await query(`SELECT socket_id FROM rooms WHERE uid = ?`, [uid]);
          const socketId = rows?.[0]?.socket_id;
          if (socketId) {
            io.to(socketId).emit('session:connected', {
              sessionId,
              userData: { id: rawJid, name, imgUrl: null }, // avatar vem depois
            });
            console.log(`[FastPath:Session] Emitted session:connected for ${sessionId}`);
          }
        }
      } catch (emitErr) {
        console.error('[FastPath:Session] Emit failed:', emitErr.message);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🧠 SAFE PATH: Buscar avatar + persistir no DB (assíncrono)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      try {
        let imgUrl = null;
        let savedPath = null;
        try {
          const { fetchProfileUrl } = require("../functions/control.js");
          const { downloadAndSaveAvatar } = require("../functions/avatar.js");
          imgUrl = jid ? await fetchProfileUrl(wa, jid) : null;
          if (!imgUrl && jid) {
            await new Promise(r => setTimeout(r, 3000));
            imgUrl = await fetchProfileUrl(wa, jid);
          }
          if (imgUrl && jid) {
            const localPath = await downloadAndSaveAvatar(imgUrl, jid);
            savedPath = localPath || imgUrl;
          }
        } catch (_) { /* non-fatal */ }

        const userData = rawJid ? JSON.stringify({ id: rawJid, name, imgUrl: savedPath }) : null;

        await query(
          `UPDATE instance SET status = 'CONNECTED', jid = ?, "userData" = ? WHERE instance_id = ?`,
          [rawJid, userData, sessionId]
        );
        console.log(`[SafePath:Session] DB updated: ${sessionId} → CONNECTED (jid=${rawJid}, hasAvatar=${!!savedPath})`);
      } catch (dbErr) {
        console.error("Failed to update instance status in DB:", dbErr);
      }
    }

    // Handle QR code generation for pairing code flow
    if (getPairCode && !wa.authState.creds.registered && qr) {
      if (res && !res.headersSent) {
        try {
          await delay(5000);
          const phoneNumber = req.body.mobile;
          console.log({ phoneNumber });
          console.log("Requesting pairing code...");
          const code = await wa.requestPairingCode(phoneNumber);

          await query(`UPDATE instance SET qr = ? WHERE instance_id = ?`, [
            code,
            sessionId,
          ]);

          res.json({
            msg: "Pairing code received, please enter the code on your phone.",
            success: true,
            code,
          });
          res.end();

          return;
        } catch (error) {
          console.error("Pairing code error:", error);
          if (!res.headersSent) {
            response(res, 500, false, "Unable to create pair code.");
          }
        }
      }
    }

    // Handle QR code generation for QR scan flow
    if (qr && !getPairCode) {
      if (res && !res.headersSent) {
        try {
          const qrImage = await toDataURL(qr);

          await query(`UPDATE instance SET qr = ? WHERE instance_id = ?`, [
            qrImage,
            sessionId,
          ]);

          // Mark that QR has been generated for this session
          qrGeneratedSessions.add(sessionId);

          res.json({
            success: true,
            msg: "QR code received, please scan the QR code.",
            qr: qrImage,
            sessionId,
          });
          res.end();

          console.log(`QR code generated for session ${sessionId}`);
          return;
        } catch (error) {
          console.error("QR generation error:", error);
          if (!res.headersSent) {
            response(res, 500, false, "Unable to create QR code.");
          }
        }
      } else {
        // QR generated but response already sent (for reconnection scenarios)
        try {
          const qrImage = await toDataURL(qr);
          await query(`UPDATE instance SET qr = ? WHERE instance_id = ?`, [
            qrImage,
            sessionId,
          ]);
          console.log(`QR code updated in database for session ${sessionId}`);
        } catch (error) {
          console.error("QR update error:", error);
        }
      }
    }

    // Handle connection close
    if (connection === "close") {
      // Mark as disconnected in DB
      try {
        await query(`UPDATE instance SET status = 'DISCONNECTED' WHERE instance_id = ?`, [sessionId]);
      } catch (_) {}

      if (
        statusCode === DisconnectReason.loggedOut ||
        !shouldReconnect(sessionId)
      ) {
        console.log(`Session ${sessionId} logged out or max retries reached.`);

        if (res && !res.headersSent) {
          response(res, 500, false, "Unable to create session.");
        }

        return exports.deleteSession(sessionId, isLegacy);
      }

      // Reconnect with appropriate delay
      setTimeout(
        () => {
          console.log(`Reconnecting session ${sessionId}...`);
          exports.createSession(sessionId, isLegacy, null, null, getPairCode);
        },
        statusCode === DisconnectReason.restartRequired ? 0 : parseInt(5000)
      );
    }
  });
};

/**
 * @returns {(import('@whiskeysockets/baileys').AnyWASocket|null)}
 */
// exports.getSession exported above

exports.deleteDirectory = (directoryPath) => {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const filePath = `${directoryPath}/${file}`;
      if (fs.lstatSync(filePath).isDirectory()) {
        exports.deleteDirectory(filePath); // Recursively delete subdirectories
      } else {
        fs.unlinkSync(filePath); // Delete files
      }
    });
    fs.rmdirSync(directoryPath); // Delete the empty directory
  }
};

/**
 * Auxiliar para deletar chaves do Redis usando SCAN (seguro para produção)
 */
async function deleteKeysByPattern(pattern) {
  const redis = getCacheClient();
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

exports.deleteSession = async (sessionId, isLegacy = false, mode = 'all') => {
  console.log(`[DeepCleanup] Starting cleanup for session: ${sessionId} (mode: ${mode})`);
  
  // ── 1. Limpeza de Mídias (Disco) ──
  try {
    const mediaDir = path.join(process.cwd(), 'public', 'media', sessionId);
    if (fs.existsSync(mediaDir)) {
      fs.rmSync(mediaDir, { recursive: true, force: true });
      console.log(`[DeepCleanup:Disco] Media folder removed: ${mediaDir}`);
    }
  } catch (err) {
    console.error(`[DeepCleanup:Disco] Error removing media folder:`, err.message);
  }
 
  // ── 2. Limpeza de Histórico (PostgreSQL) ──
  try {
    // Apagar mensagens e chats vinculados à instância
    const qMsgs = await query(`DELETE FROM messages WHERE instance_id = ?`, [sessionId]);
    const qChats = await query(`DELETE FROM chats WHERE instance_id = ?`, [sessionId]);
    console.log(`[DeepCleanup:PG] History cleared: ${qMsgs.affectedRows || '?'} msgs, ${qChats.affectedRows || '?'} chats`);
    
    // Apagar credenciais de autenticação APENAS se mode for 'all'
    if (mode === 'all') {
      await removeSessionFromDB(sessionId);
      console.log(`[DeepCleanup:PG] Auth state removed`);
    } else {
      console.log(`[DeepCleanup:PG] Mode data_only: Preserving Auth state`);
    }
  } catch (err) {
    console.error(`[DeepCleanup:PG] Error clearing database:`, err.message);
  }
 
  // ── 3. Limpeza de Hot Cache (Redis) ──
  try {
    const redis = getCacheClient();
    
    // Deleta o Inbox ZSET
    await redis.del(K.inbox(sessionId));
    
    // Escaneia e deleta todas as listas de mensagens msgs:instanceId:*
    await deleteKeysByPattern(`msgs:${sessionId}:*`);
    
    console.log(`[DeepCleanup:Redis] Hot cache purged for ${sessionId}`);
  } catch (err) {
    console.error(`[DeepCleanup:Redis] Error purging cache:`, err.message);
  }
 
  // ── 4. Limpeza de Metadados e Memória (APENAS se mode for 'all') ──
  if (mode === 'all') {
    sessions.delete(sessionId);
    retries.delete(sessionId);
    qrGeneratedSessions.delete(sessionId);
    console.log(`[DeepCleanup:RAM] Session metadata removed from memory`);
  } else {
    console.log(`[DeepCleanup:RAM] Mode data_only: Preserving memory session`);
  }
 
  const dirName = process.cwd();
  deleteFileIfExists(`${dirName}/contacts/${sessionId}.json`);
  
  console.log(`[DeepCleanup] Finished for session: ${sessionId} (mode: ${mode})`);
};

exports.getChatList = (sessionId, isGroup = false) => {
  // Since we don't have store anymore, we'll return an empty array
  // You might want to implement this differently based on your needs
  console.log("getChatList: Store not available, returning empty array");
  return [];
};

/**
 * @param {import('@whiskeysockets/baileys').AnyWASocket} session
 */
exports.isExists = async (session, jid, isGroup = false) => {
  console.log({ jid });
  try {
    let result;

    if (isGroup) {
      console.log("This is group check");
      result = await session.groupMetadata(jid);
      return Boolean(result.id);
    }

    if (session?.isLegacy) {
      result = await session.onWhatsApp(jid);
    } else {
      [result] = await session.onWhatsApp(jid);

      if (typeof result === "undefined") {
        console.log("checked");
        const getNum = jid.replace("@s.whatsapp.net", "");
        [result] = await session.onWhatsApp(`+${getNum}`);
      }
    }

    console.log({ result: result });

    return result?.exists;
  } catch (err) {
    console.log(err);
    return false;
  }
};

function replaceWithRandom(inputText) {
  let updatedText = inputText;

  while (updatedText.includes("[") && updatedText.includes("]")) {
    const start = updatedText.indexOf("[");
    const end = updatedText.indexOf("]");

    if (start !== -1 && end !== -1) {
      const arrayText = updatedText.substring(start + 1, end);
      const items = arrayText.split(",").map((item) => item.trim());

      if (items.length > 0) {
        const randomIndex = Math.floor(Math.random() * items.length);
        const randomItem = items[randomIndex];

        updatedText =
          updatedText.substring(0, start) +
          randomItem +
          updatedText.substring(end + 1);
      }
    }
  }

  return updatedText;
}

/**
 * @param {import('@whiskeysockets/baileys').AnyWASocket} session
 */
exports.sendMessage = async (session, receiver, message) => {
  try {
    console.log("A");
    if (message?.text) {
      console.log("B");
      try {
        const linkPreview = await getUrlInfo(message?.text, {
          thumbnailWidth: 1024,
          fetchOpts: {
            timeout: 5000,
          },
          uploadImage: session.waUploadToServer,
        });

        console.log("C");
        message = {
          text: replaceWithRandom(message?.text),
          linkPreview,
        };
      } catch (error) {
        console.error("Error generating link preview:", error);
        // Continue with just text if link preview fails
        message = {
          text: replaceWithRandom(message?.text),
        };
      }
    } else {
      console.log("D");
      message = message;
    }

    console.log("E");
    console.log({ sendingMsg: message });

    if (message?.caption) {
      console.log("F");
      message = { ...message, caption: replaceWithRandom(message?.caption) };
    } else {
      console.log("G");
      message = message;
    }

    console.log("H");
    console.log({ isLegacy: session?.isLegacy || "NA", message: message });
    await delay(1000);
    console.log("I");
    return session.sendMessage(receiver, message);
  } catch (err) {
    console.log(err);
    return Promise.reject(null); // eslint-disable-line prefer-promise-reject-errors
  }
};

exports.getGroupData = async (session, jid) => {
  try {
    const part = await session.groupMetadata(jid);
    return part;
  } catch {
    return Promise.reject(null); // eslint-disable-line prefer-promise-reject-errors
  }
};

exports.formatPhone = (phone) => {
  if (phone.endsWith("@s.whatsapp.net")) {
    return phone;
  }

  let formatted = phone.replace(/\D/g, "");

  return (formatted += "@s.whatsapp.net");
};

exports.formatGroup = (group) => {
  if (group.endsWith("@g.us")) {
    return group;
  }

  let formatted = group.replace(/[^\d-]/g, "");

  return (formatted += "@g.us");
};

// Função auxiliar para validar se uma sessão está autenticada
exports.isSessionAuthenticated = (session) => {
  if (!session) return false;
  
  // Verificar se está conectada
  if (session.ws?.readyState !== 1) return false; // 1 = OPEN
  
  // Verificar dados de autenticação
  const hasAuthData = session.authState?.creds?.me || 
                     session.authState?.creds?.registered ||
                     session.user;
  
  return !!hasAuthData;
};

// Função auxiliar para obter dados do usuário
exports.getSessionUserData = (session) => {
  return session?.authState?.creds?.me || 
         session?.user || 
         null;
};

const cleanup = () => {
  console.log("Running graceful cleanup before exit.");
  
  // Não forçar fechamento imediato das sessões
  // Deixar o Baileys gerenciar suas próprias desconexões
  sessions.forEach((session, sessionId) => {
    try {
      console.log(`Gracefully closing session ${sessionId}`);
      // Apenas marcar para desconexão, não forçar
      if (session && typeof session.logout === 'function') {
        session.logout();
      }
    } catch (error) {
      console.error(`Error during graceful cleanup for session ${sessionId}:`, error);
    }
  });
  
  // Aguardar um tempo para cleanup natural
  setTimeout(() => {
    console.log("Cleanup completed, exiting gracefully.");
    process.exit(0);
  }, 5000);
};

const init = async () => {
  // Ensure Baileys is initialized before starting sessions
  if (!makeWASocket) {
    await initBaileys();
  }

  // Restaurar sessoes a partir do PostgreSQL (tabela instance)
  // Busca todas as instancias que estavam conectadas e recria as sessoes
  try {
    const instances = await query('SELECT instance_id FROM instance WHERE status IS NOT NULL');
    console.log(`[Auth] Found ${instances.length} instance(s) to restore from DB`);
    for (const inst of instances) {
      const sessionId = inst.instance_id;
      exports.createSession(sessionId, false);
    }
  } catch (err) {
    console.error('[Auth] Error restoring sessions from DB:', err.message);
  }

  // DESATIVADO: restaurar sessoes a partir de arquivos .json no filesystem
  // const sessionsPath = path.join(dirName, "sessions");
  // fs.readdir(sessionsPath, (err, files) => {
  //   if (err) { throw err; }
  //   for (const file of files) {
  //     if (!file.endsWith(".json") || !file.startsWith("md_") || file.includes("_store")) {
  //       continue;
  //     }
  //     const filename = file.replace(".json", "");
  //     const isLegacy = filename.split("_", 1)[0] !== "md";
  //     const sessionId = filename.substring(isLegacy ? 7 : 3);
  //     exports.createSession(sessionId, isLegacy);
  //   }
  // });
};
exports.init = init;
exports.cleanup = () => {
  console.log("Cleanup called");
};

exports.getUrlInfo = async (...args) => {
  if (!getUrlInfo) await initBaileys();
  return getUrlInfo(...args);
};

exports.downloadMediaMessage = async (...args) => {
  if (!downloadMediaMessage) await initBaileys();
  return downloadMediaMessage(...args);
};
