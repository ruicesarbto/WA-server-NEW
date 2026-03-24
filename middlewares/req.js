const { existsSync, unlinkSync, readdir } = require("fs");
const { join } = require("path");
const pino = require("pino");

// Baileys variables - will be initialized dynamically
let makeWASocket;
let Browsers,
  DisconnectReason,
  delay,
  useMultiFileAuthState,
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
      useMultiFileAuthState,
      getAggregateVotesInPollMessage,
      downloadMediaMessage,
      getUrlInfo,
      makeCacheableSignalKeyStore,
      fetchLatestBaileysVersion,
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

  const { state, saveCreds } = await useMultiFileAuthState(
    sessionsDir(sessionFile)
  );

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

  // Helper: try to fetch and save own avatar to DB
  async function trySaveOwnAvatar() {
    try {
      const rawJid = wa.user?.id;
      if (!rawJid) return;
      const myJid = rawJid.split(':')[0] + '@s.whatsapp.net';
      const { fetchProfileUrl } = require("../functions/control.js");
      const imgUrl = await fetchProfileUrl(wa, myJid);
      if (!imgUrl) return;
      const creds = wa?.authState?.creds;
      const name = creds?.me?.name || null;
      const userData = JSON.stringify({ id: rawJid, name, imgUrl });
      await query(
        `UPDATE instance SET userData = ? WHERE instance_id = ?`,
        [userData, sessionId]
      );
      console.log(`Own avatar saved for session ${sessionId}: ${imgUrl.substring(0, 60)}...`);
    } catch (_) { /* non-fatal */ }
  }

  wa.ev.on("messaging-history.set", async (data) => {
    const contactData = data.contacts;
    const chats = data.chats;

    const filterdGroupChats = chats.filter((item) => {
      return item?.id?.endsWith("@g.us");
    });

    const filterdChats = chats.filter((item) => {
      return item?.id?.endsWith("@s.whatsapp.net");
    });

    const filteredContacts = contactData.filter((item) =>
      item.id.endsWith("@s.whatsapp.net")
    );

    const { uid } = decodeObject(sessionId);

    if (filteredContacts.length > 0) {
      createJsonFile(`${sessionId}__two`, saveContacts(filteredContacts), uid);
    }

    // Try to grab own avatar from history sync contacts or direct fetch
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
        // Not in contacts list, try direct fetch
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
  });

  wa.ev.on("messages.update", async (m) => {
    const message = m[0];

    if (message?.update?.pollUpdates?.length > 0) {
      // For poll updates, we need to get the original message from the chat
      // Since we don't have store, we'll pass the update directly
      const pollMessage = getAggregateVotesInPollMessage({
        message: message,
        pollUpdates: message?.update?.pollUpdates,
      });

      updateDelivery(message, sessionId, pollMessage);
      const session = await exports.getSession(sessionId);

      const a = { messages: m };
      chatbotInit(a, wa, sessionId, session, pollMessage);
    } else {
      if (
        message?.update &&
        message?.key?.remoteJid !== "status@broadcast" &&
        message?.key?.remoteJid &&
        message?.update?.status
      ) {
        updateDelivery(message, sessionId);
      }
    }
  });

  function saveFile(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  }

  // Automatically read incoming messages
  wa.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
    const session = await exports.getSession(sessionId);

    if (message?.key?.remoteJid !== "status@broadcast" && m.type === "notify") {
      if (!message.key.fromMe) {
        chatbotInit(m, wa, sessionId, session);
      }

      webhookIncoming(message, sessionId, session);
    }
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
      qrGeneratedSessions.delete(sessionId); // Clear QR flag on successful connection
      console.log(`Session ${sessionId} connected successfully!`);

      // Update DB: mark instance as CONNECTED and store JID + pushname + avatar
      try {
        const creds = wa?.authState?.creds;
        const rawJid = creds?.me?.id || null;
        const name   = creds?.me?.name || null;
        // Strip device suffix: "67999222377:6@s.whatsapp.net" → "67999222377@s.whatsapp.net"
        const jid = rawJid && rawJid.includes(':')
          ? rawJid.replace(/:.*@/, '@')
          : rawJid;

        // Fetch profile picture once on connect (lazy require to avoid circular dep)
        let imgUrl = null;
        try {
          const { fetchProfileUrl } = require("../functions/control.js");
          imgUrl = jid ? await fetchProfileUrl(wa, jid) : null;
        } catch (_) { /* non-fatal */ }

        const userData = rawJid ? JSON.stringify({ id: rawJid, name, imgUrl }) : null;

        await query(
          `UPDATE instance SET status = 'CONNECTED', jid = ?, userData = ? WHERE instance_id = ?`,
          [rawJid, userData, sessionId]
        );
        console.log(`DB updated: ${sessionId} → CONNECTED (jid=${rawJid}, name=${name}, hasAvatar=${!!imgUrl})`);
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

exports.deleteSession = async (sessionId, isLegacy = false) => {
  const sessionFile = "md_" + sessionId;

  const dirName = process.cwd();
  deleteFileIfExists(`${dirName}/contacts/${sessionId}.json`);

  if (isSessionFileExists(sessionFile)) {
    exports.deleteDirectory(sessionsDir(sessionFile));
  }

  sessions.delete(sessionId);
  retries.delete(sessionId);
  qrGeneratedSessions.delete(sessionId);
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

  const sessionsPath = path.join(dirName, "sessions");

  fs.readdir(sessionsPath, (err, files) => {
    if (err) {
      throw err;
    }

    for (const file of files) {
      if (
        !file.endsWith(".json") ||
        !file.startsWith("md_") ||
        file.includes("_store")
      ) {
        continue;
      }

      const filename = file.replace(".json", "");
      const isLegacy = filename.split("_", 1)[0] !== "md";
      const sessionId = filename.substring(isLegacy ? 7 : 3);

      exports.createSession(sessionId, isLegacy);
    }
  });
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
