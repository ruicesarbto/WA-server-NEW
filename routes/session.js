const router = require("express").Router();
const { query } = require("../database/dbpromise.js");
const bcrypt = require("bcryptjs");
const { sign } = require("jsonwebtoken");
const validateUser = require("../middlewares/user.js");
const moment = require("moment");
const {
  isValidEmail,
  encodeObject,
  decodeObject,
  fetchProfileUrl,
  readJsonFileContact,
} = require("../functions/function.js");
const randomstring = require("randomstring");
const reqMiddleware = require("../middlewares/req.js");
const {
  createSession,
  sendMessage,
  getSession,
  formatPhone,
  deleteSession,
} = reqMiddleware;
const {
  checkPlanExpiry,
  checkForSessions,
} = require("../middlewares/planValidator.js");

// create sessios
router.post(
  "/create_qr",
  validateUser,
  checkPlanExpiry,
  checkForSessions,
  async (req, res) => {
    try {
      const { title, syncMax } = req.body;

      if (!title) {
        return res.json({ msg: "Please give instance a name" });
      }

      const sessionId = encodeObject({
        uid: req.decode.uid,
        client_id: title,
      });

      console.log({
        sessionId,
        obj: {
          uid: req.decode.uid,
          client_id: title,
        },
      });

      await query(
        `INSERT INTO instance (uid, instance_id, title, status) VALUES (?,?,?,?)`,
        [req.decode.uid, sessionId, title, "CREATED"]
      );

      createSession(sessionId, false, req, res, false, syncMax);
    } catch (err) {
      res.json({ success: false, msg: "something went wrong" });
      console.log(err);
    }
  }
);

// get session status
router.post("/status", validateUser, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.json({ msg: "Session id not found" });
    }

    const states = ["connecting", "connected", "disconnecting", "disconnected"];

    const session = await getSession(id);

    if (!session) {
      return res.json({
        msg: "Invalid session found",
        success: false,
      });
    }

    // Debug logs para identificar problemas de autenticação
    console.log("Session validation debug:", {
      sessionId: id,
      hasSession: !!session,
      wsState: session?.ws?.readyState,
      hasAuthState: !!session?.authState,
      hasCreds: !!session?.authState?.creds,
      hasMe: !!session?.authState?.creds?.me,
      hasUser: !!session?.user,
      isLegacy: session?.isLegacy,
      credsMe: session?.authState?.creds?.me
    });

    let state = states[session.ws.readyState];

    state =
      state === "connected" &&
      (session?.authState?.creds?.me || session.user)
        ? "authenticated"
        : state;

    const liveUser = session?.authState?.creds?.me || session.user;
    const status = !!liveUser;

    // Fetch existing userData to preserve imgUrl
    const getDb = await query(`SELECT * FROM instance WHERE instance_id = ?`, [id]);
    let existingImgUrl = null;
    try {
      const rawUd = getDb[0]?.userdata ?? getDb[0]?.userData;
      const existing = typeof rawUd === 'string' ? JSON.parse(rawUd) : (rawUd || null);
      existingImgUrl = existing?.imgUrl || null;
    } catch (_) {}

    const userData = liveUser ? { ...liveUser, imgUrl: liveUser.imgUrl || existingImgUrl } : null;

    await query(
      `UPDATE instance SET "userData" = ?, jid = ? WHERE instance_id = ?`,
      [JSON.stringify(userData), extractPhoneNumber(liveUser?.id), id]
    );

    res.json({
      success: true,
      status,
      userData,
      qr: getDb?.length > 0 ? getDb[0]?.qr : null,
      webhook: getDb?.length > 0 ? getDb[0]?.webhook : null,
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    console.log(err);
  }
});

// get profile image of the instance (+ download + persist)
router.post("/get_profile_image", validateUser, async (req, res) => {
  try {
    const { instance_id } = req.body;
    
    if (!instance_id) {
      return res.json({ success: false, msg: "Instance ID required" });
    }

    const session = await getSession(instance_id);
    
    if (!session) {
      // Sem sessão Baileys — tenta retornar avatar do DB
      const dbRow = await query(`SELECT "userData" FROM instance WHERE instance_id = ?`, [instance_id]);
      let dbAvatar = null;
      try {
        const raw = dbRow[0]?.userData;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        dbAvatar = parsed?.imgUrl || null;
      } catch {}
      return res.json({ success: true, profileImage: dbAvatar, source: 'db' });
    }

    const userData = session?.authState?.creds?.me || session.user;
    const rawJid = userData?.id;

    if (!rawJid) {
      return res.json({ success: false, msg: "User not authenticated" });
    }

    // Normalizar JID: "number:device@s.whatsapp.net" → "number@s.whatsapp.net"
    const jid = rawJid.includes(':')
      ? rawJid.replace(/:.*@/, '@')
      : rawJid;

    // 1. Buscar URL do WhatsApp CDN
    const profileImage = await fetchProfileUrl(session, jid);
    
    if (!profileImage) {
      return res.json({ success: true, profileImage: null, msg: "No profile picture available" });
    }

    // 2. Baixar e salvar localmente
    let savedPath = profileImage;
    try {
      const { downloadAndSaveAvatar } = require("../functions/avatar.js");
      const localPath = await downloadAndSaveAvatar(profileImage, jid);
      savedPath = localPath || profileImage;
    } catch {}

    // 3. Persistir no DB
    try {
      const dbRow = await query(`SELECT "userData" FROM instance WHERE instance_id = ?`, [instance_id]);
      let existing = {};
      try {
        const raw = dbRow[0]?.userData;
        existing = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      } catch {}
      existing.imgUrl = savedPath;
      await query(
        `UPDATE instance SET "userData" = ? WHERE instance_id = ?`,
        [JSON.stringify(existing), instance_id]
      );
    } catch {}

    res.json({
      success: true,
      profileImage: savedPath,
      source: 'whatsapp'
    });
    
  } catch (err) {
    res.json({ success: false, msg: "Error fetching profile image", err: err.message });
  }
});

// Busca metadata real de um grupo via Baileys (subject, participantes)
router.post("/sync_group_metadata", validateUser, async (req, res) => {
  try {
    const { remote_jid, instance } = req.body;
    if (!remote_jid || !remote_jid.endsWith('@g.us')) {
      return res.json({ ok: false, msg: "JID de grupo inválido" });
    }

    const session = await getSession(instance || 'main');
    if (!session) {
      return res.json({ ok: false, msg: "Sessão não encontrada" });
    }

    const metadata = await session.groupMetadata(remote_jid);
    res.json({
      ok: true,
      subject: metadata?.subject || null,
      desc: metadata?.desc || null,
      participants: (metadata?.participants || []).length,
    });
  } catch (err) {
    console.error('[sync_group_metadata]', err.message);
    res.json({ ok: false, msg: err.message });
  }
});

// reconnect session to generate new QR code
router.post("/reconnect", validateUser, async (req, res) => {
  try {
    const { instance_id } = req.body;

    if (!instance_id) {
      return res.json({ success: false, msg: "Instance ID is required" });
    }

    // Check if instance exists
    const instance = await query(`SELECT * FROM instance WHERE instance_id = ? AND uid = ?`, [
      instance_id, 
      req.decode.uid
    ]);

    if (!instance || instance.length === 0) {
      return res.json({ success: false, msg: "Instance not found" });
    }

    // Get existing session
    const existingSession = await getSession(instance_id);
    
    if (existingSession) {
      // Close existing session gracefully
      try {
        await existingSession.logout();
      } catch (e) {
        console.log('Error logging out existing session:', e);
      }
    }

    // Update instance status to CREATED to trigger QR generation and clear old QR
    await query(`UPDATE instance SET status = ?, qr = NULL WHERE instance_id = ?`, [
      "CREATED", 
      instance_id
    ]);

    // Create new session (this will generate QR code)
    const { createSession } = require('../middlewares/req.js');
    createSession(instance_id, false, req, res, false, false);

  } catch (err) {
    console.error('Reconnect error:', err);
    res.json({ success: false, msg: "Failed to reconnect session", err: err.message });
  }
});

function extractPhoneNumber(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(?=:|\@)/);
  return match ? match[1] : null;
}

// get instances with status
router.get("/get_instances_with_status", validateUser, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM instance WHERE uid = ?`, [
      req.decode.uid,
    ]);
    if (data.length < 1) {
      return res.json({
        success: true,
        data: [],
      });
    } else {
      const instances = await Promise.all(
        data.map(async (i) => {
          const states = [
            "connecting",
            "connected",
            "disconnecting",
            "disconnected",
          ];

          const session = await getSession(i?.instance_id);

          // Preservar imgUrl do DB sempre
          let existingImgUrl = null;
          try {
            const rawUd = i.userdata ?? i.userData;
            const existing = typeof rawUd === 'string' ? JSON.parse(rawUd) : (rawUd || null);
            existingImgUrl = existing?.imgUrl || null;
          } catch (_) {}

          if (!session) {
            // Sem sessão Baileys na RAM — retorna dados do DB
            let dbUserData = null;
            try {
              const rawUd = i.userdata ?? i.userData;
              dbUserData = typeof rawUd === 'string' ? JSON.parse(rawUd) : (rawUd || null);
            } catch (_) {}
            return {
              success: true,
              status: false,
              state: 'disconnected',
              userData: dbUserData,
              i,
            };
          }

          let state = states[session.ws.readyState] || 'disconnected';

          state =
            state === "connected" &&
            (session?.authState?.creds?.me || session.user)
              ? "authenticated"
              : state;

          const liveUser = session?.authState?.creds?.me || session.user;
          const isAuthenticated = !!liveUser;

          const userData = liveUser
            ? { ...liveUser, imgUrl: liveUser.imgUrl || existingImgUrl }
            : null;

          // Só faz UPDATE se tiver dados novos
          if (liveUser) {
            await query(
              `UPDATE instance SET "userData" = ?, jid = ? WHERE instance_id = ?`,
              [
                JSON.stringify(userData),
                extractPhoneNumber(liveUser?.id),
                i?.instance_id,
              ]
            );
          }

          return {
            success: true,
            status: isAuthenticated,
            state,
            userData,
            i,
          };
        })
      );

      // NÃO filtra mais — retorna TODAS as instâncias com seu estado real
      res.json({
        data: instances,
        success: true,
      });
    }
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    console.log(err);
  }
});

// del instance
router.post("/del_ins", validateUser, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.json({ success: false, msg: "Invalid request (missing ID)" });
    }

    const session = await getSession(id);

    if (session) {
      console.log(`[SessionRoute] Logging out and deleting session: ${id}`);
      try {
        // Tentativa de logout formal no WhatsApp
        await session.logout();
      } catch (logoutErr) {
        console.warn(`[SessionRoute] Logout failed for ${id} (ignoring):`, logoutErr.message);
        // Se falhar (ex: já desconectado), seguimos para deletar localmente
      }
    } else {
      console.log(`[SessionRoute] No active session in memory for ${id}, proceeding with database cleanup.`);
    }

    // Faxina profunda (Redis, Disco, PG History/Auth)
    await deleteSession(id, session?.isLegacy);

    // Deletar da tabela instance (PostgreSQL)
    await query(`DELETE FROM instance WHERE instance_id = ?`, [id]);

    res.json({
      success: true,
      msg: "Instance and all related data were deleted successfully",
    });
  } catch (err) {
    console.error(`[SessionRoute:Error] Failed to delete instance ${req.body.id}:`, err);
    res.json({ success: false, msg: "Something went wrong while deleting instance" });
  }
});

// get user instances
router.get("/get_mine", validateUser, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM instance WHERE uid = ?`, [
      req.decode.uid,
    ]);
    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    console.log(err);
  }
});

// get my contacts list
router.post("/instance_contact", validateUser, async (req, res) => {
  try {
    const { instance } = req.body;

    if (!instance) {
      return res.json({ msg: "Invalid request" });
    }

    const filePathOne = `${__dirname}/../contacts/${instance}__one.json`;

    const filePathTwo = `${__dirname}/../contacts/${instance}__two.json`;

    const contactsOne = readJsonFileContact(filePathOne);
    const contactsTwo = readJsonFileContact(filePathTwo);

    const session = await getSession(instance);

    if (!session) {
      return res.json({ msg: "This session is either busy or invalid" });
    }

    const totalContacts = [...contactsOne, ...contactsTwo];

    // const promises = totalContacts.map(async (i) => {
    //     const profileImg = await fetchProfileUrl(session, i?.id, true)
    //     return {
    //         ...i,
    //         profileImg: profileImg
    //     }
    // })

    // const contacts = await Promise.all(promises);

    console.log({
      totalContacts,
    });

    res.json({ data: totalContacts, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    console.log(err);
  }
});

// change instance status
router.post("/change_instance_status", validateUser, async (req, res) => {
  try {
    const statuses = [
      "unavailable",
      "available",
      "composing",
      "recording",
      "paused",
    ];

    const { insId, status, jid } = req.body;

    const session = await getSession(insId);

    if (!session) {
      return res.json({
        msg: "Unable to change status right now WA is busy",
      });
    }

    if (!statuses.includes(status)) {
      return res.json({
        msg: "Invalid status found",
      });
    }

    await session.sendPresenceUpdate(status);
    await query(`UPDATE instance SET a_status = ? WHERE instance_id = ?`, [
      status,
      insId,
    ]);

    res.json({
      success: true,
      msg: "Updated",
    });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    console.log(err);
  }
});

// update weboook url
router.post("/update_webhook_url", validateUser, async (req, res) => {
  try {
    const { webhook, instance_id } = req.body;

    if (!webhook) {
      return res.json({ msg: "Please enter webhook URL" });
    }

    await query(
      `UPDATE instance SET webhook = ? WHERE instance_id = ? AND uid = ?`,
      [webhook, instance_id, req.decode.uid]
    );
    res.json({ success: true, msg: "Webhook url updated" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    console.log(err);
  }
});

module.exports = router;
