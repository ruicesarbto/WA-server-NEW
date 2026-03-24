'use client';

import { getAccessToken } from './auth-cookies';

const BASE = '';  // relative — rewrites handled by Next.js

async function request<T = any>(
    method: string,
    path: string,
    body?: any,
    isFormData = false,
): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body && !isFormData) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ msg: res.statusText }));
        throw new Error(err?.msg || `HTTP ${res.status}`);
    }
    return res.json();
}

// ─── Generic helpers ──────────────────────────────────────────────────────────
const get = <T = any>(path: string) => request<T>('GET', path);
const post = <T = any>(path: string, body?: any) => request<T>('POST', path, body);
const put = <T = any>(path: string, body?: any) => request<T>('PUT', path, body);
const del = <T = any>(path: string) => request<T>('DELETE', path);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function login(email: string, password: string) {
    return post('/api/user/login', { email, password });
}

// ─── INSTANCES ────────────────────────────────────────────────────────────────
async function getWhatsAppInstances() {
    // Fetch all instances from DB (includes disconnected ones)
    const allRes = await get('/api/session/get_mine');
    const allRaw: any[] = allRes?.data || [];

    // Fetch live-connected instances to overlay real connection status
    const connectedIds = new Set<string>();
    const liveMap: Record<string, any> = {};
    try {
        const liveRes = await get('/api/session/get_instances_with_status');
        const liveItems: any[] = liveRes?.data || [];
        liveItems.forEach((item: any) => {
            const id = item?.i?.instance_id;
            if (id && item.status === true) {
                connectedIds.add(id);
                liveMap[id] = item;
            }
        });
    } catch { /* ignore — fall back to DB status */ }

    // Fetch profile images for connected instances in parallel
    const avatarMap: Record<string, string | null> = {};
    await Promise.all(
        allRaw
            .filter(r => connectedIds.has(r.instance_id))
            .map(async (r) => {
                try {
                    const res = await post('/api/session/get_profile_image', { instance_id: r.instance_id });
                    avatarMap[r.instance_id] = res?.profileImage || null;
                } catch { avatarMap[r.instance_id] = null; }
            })
    );

    const instances = allRaw.map((r: any) => {
        const userData = typeof r.userData === 'string' ? (() => { try { return JSON.parse(r.userData); } catch { return null; } })() : (r.userData || null);
        const live = liveMap[r.instance_id];
        const liveUser = live?.userData || userData;
        const isConnected = connectedIds.has(r.instance_id);
        const jid = r.jid || liveUser?.id?.split(':')[0] || '';
        const avatar = avatarMap[r.instance_id] || liveUser?.imgUrl || userData?.imgUrl || r.profile_pic || null;
        return {
            instance: r.instance_id,
            status: isConnected ? 'connected' : 'disconnected',
            hasQr: false,
            createdAt: r.created_at || new Date().toISOString(),
            phone: r.title || jid || r.instance_id?.slice(0, 12) || 'Sessão',
            nome: liveUser?.name || r.title || '',
            avatar,
            profilePictureUrl: avatar,
            webhook_url: r.webhook_url || '',
            metrics: { sent: r.sent_count || 0, failed: r.failed_count || 0 },
        };
    });
    return { instances, saved: instances.map((i: any) => i.instance) };
}

async function createWhatsAppInstance(name: string) {
    // POST /api/session/create_qr → triggers QR code generation via SSE/socket
    return post('/api/session/create_qr', { title: name, instance_id: name, syncMax: 0 });
}

async function getWhatsAppQr(name: string, _number?: string) {
    // Call /reconnect — the backend blocks until Baileys generates a fresh QR,
    // then responds with { success: true, qr: "data:image/png;base64,...", sessionId }
    // This can take 5-15s while Baileys initialises the WA connection.
    const token = getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/session/reconnect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ instance_id: name }),
        signal: AbortSignal.timeout(60000), // 60s max
    });

    const data = await res.json();

    if (data?.status === 'connected' || data?.instance?.status === 'open') {
        return { ok: true, status: 'connected', message: data.msg || data.message || 'Conectado', qr: null, pairingCode: null };
    }
    if (data?.qr) {
        return { ok: true, qr: data.qr, pairingCode: data.pairingCode || null };
    }
    if (data?.pairingCode) {
        return { ok: true, qr: null, pairingCode: data.pairingCode };
    }

    // Fallback: check DB for a freshly generated QR
    const mine = await get('/api/session/get_mine');
    const inst = (mine?.data || []).find((r: any) => r.instance_id === name);
    if (inst?.qr) {
        return { ok: true, qr: inst.qr, pairingCode: null };
    }

    return { ok: false, qr: null, pairingCode: null, status: data?.status || null, message: data?.msg || data?.error || 'Erro desconhecido' };
}

async function disconnectWhatsAppInstance(name: string) {
    return post('/api/session/reconnect', { instance_id: name });
}

async function deleteWhatsAppInstance(name: string) {
    return post('/api/session/del_ins', { id: name });
}

async function updateWhatsAppWebhook(instanceId: string, webhookUrl: string) {
    return post('/api/session/update_webhook_url', { id: instanceId, webhook_url: webhookUrl });
}

async function updateWhatsAppPhoto(name: string) {
    return post('/api/session/get_profile_image', { id: name });
}

// ─── CHATS ────────────────────────────────────────────────────────────────────
async function getWhatsAppChats(instance: string) {
    const res = await get(`/api/inbox/get_my_chats?instance=${encodeURIComponent(instance)}`);
    // Backend fields: id, chat_id, sender_name, sender_mobile, sender_jid,
    //   profile_image, last_message (JSON), last_message_came (Unix), instance_id, is_opened
    const raw: any[] = res?.data || [];
    const chats = raw.map((r: any) => {
        // Parse the last_message JSON string
        let lastMsgText: string | null = null;
        let lastMsgFromMe: number | null = null;
        let lastMsgTime: string | null = null;
        let lastMsgStatus: string | null = null;
        try {
            const lm = typeof r.last_message === 'string' ? JSON.parse(r.last_message) : (r.last_message || null);
            if (lm) {
                const rawText = lm?.msgContext?.text || lm?.text || null;
                // For media messages with no caption, show a type label
                if (!rawText && lm?.type) {
                    const t = String(lm.type).toLowerCase();
                    if (t === 'image') lastMsgText = '📷 Imagem';
                    else if (t === 'video') lastMsgText = '🎬 Vídeo';
                    else if (t === 'audio' || t === 'ptt') lastMsgText = '🎤 Áudio';
                    else if (t === 'document') lastMsgText = '📄 Documento';
                    else if (t === 'sticker') lastMsgText = '🖼️ Figurinha';
                    else lastMsgText = rawText;
                } else {
                    lastMsgText = rawText;
                }
                lastMsgFromMe = lm?.route === 'outgoing' ? 1 : 0;
                lastMsgTime = lm?.timestamp ? new Date(Number(lm.timestamp) * 1000).toISOString() : null;
                // Extract delivery status (only relevant for outgoing messages)
                if (lastMsgFromMe === 1) {
                    const s = lm?.status;
                    if (s === 'read' || s === 4) lastMsgStatus = 'read';
                    else if (s === 'delivered' || s === 3) lastMsgStatus = 'delivered';
                    else if (s === 'sent' || s === 2) lastMsgStatus = 'sent';
                    else if (s === 'pending' || s === 1) lastMsgStatus = 'pending';
                    else if (s === 'failed' || s === 0) lastMsgStatus = 'failed';
                    else lastMsgStatus = 'sent';
                }
            }
        } catch { /* ignore parse errors */ }

        // Fallback timestamp from last_message_came (Unix seconds)
        if (!lastMsgTime && r.last_message_came) {
            lastMsgTime = new Date(Number(r.last_message_came) * 1000).toISOString();
        }

        const phone = r.sender_mobile || r.phone || '';
        const jid   = r.sender_jid   || (phone ? `${phone}@s.whatsapp.net` : '');
        const name  = r.sender_name  || r.name || null;

        return {
            id: r.id,
            chat_id: r.chat_id || null,          // base64 key — used for get_convo
            instance_name: r.instance_id || instance,
            remote_jid: jid,
            phone,
            lead_id: r.lead_id || null,
            lead_name: name,
            lead_status: r.chat_status || null,
            lead_email: null,
            lead_type: null,
            avatar_url: r.profile_image || r.profile_pic || r.avatar_url || null,
            bio: null,
            subject: null,
            displayName: name || phone || jid.split('@')[0] || null,
            last_message_text: lastMsgText,
            last_message_time: lastMsgTime,
            last_message_from_me: lastMsgFromMe,
            last_message_status: lastMsgStatus,
            unread_count: r.is_opened ? 0 : 1,
            labels: [],
            is_pinned: 0,
            is_archived: 0,
            muted_until: null,
        };
    });
    return { chats, userData: res?.userData };
}

async function getWhatsAppContacts(instance: string) {
    const res = await get(`/api/user/get_contacts?instance=${encodeURIComponent(instance)}`);
    return { contacts: res?.data || [] };
}

async function getWhatsAppGroups(instance: string) {
    // Legacy backend doesn't have a dedicated groups endpoint — return empty
    return { groups: [] };
}

async function getWhatsAppHistory(
    phone: string,
    limit = 50,
    offset = 0,
    instance?: string,
    remoteJid?: string,
    chatId?: string,        // base64 chat_id — backend key for conversation file
) {
    // Backend stores conversations as files named by chat_id (base64 key)
    const res = await post('/api/user/get_convo', { chatId: chatId || remoteJid });

    // Transform backend message format → frontend Message format
    const rawMsgs: any[] = Array.isArray(res?.data) ? res.data : [];
    const messages = rawMsgs.map((r: any, idx: number) => ({
        id: idx,
        chat_id: 0,
        message_id: r.msgId || `${r.timestamp}-${idx}`,
        text: r.msgContext?.text || r.text || '',
        type: r.type || 'text',
        direction: r.route === 'outgoing' ? 'out' : 'in',
        status: r.status || (r.route === 'outgoing' ? 'sent' : 'pending'),
        timestamp: r.timestamp ? new Date(Number(r.timestamp) * 1000).toISOString() : new Date().toISOString(),
        media_url: r.msgContext?.url || r.msgContext?.mediaUrl || r.media_url || null,
        media_type: r.type !== 'text' ? r.type : undefined,
        reactions: r.reaction ? { [r.reaction]: r.reaction } : null,
        message_payload: r,
        participant: r.senderName || null,
    }));

    return {
        messages: messages.reverse(), // backend returns ASC, frontend wants DESC for prepend
        hasMore: false,
        nextOffset: offset + messages.length,
    };
}

// ─── MESSAGING ────────────────────────────────────────────────────────────────
async function sendWhatsAppText(
    instance: string,
    to: string,
    text: string,
    leadId?: number | string,
    quotedId?: string,
    remoteJid?: string,
    quoted?: any,
    chatId?: string | null,
    toName?: string | null,
) {
    return post('/api/inbox/send_text', {
        id: instance,
        to: to,
        msg: text,
        lead_id: leadId,
        quoted_id: quotedId,
        sender: remoteJid,
        quoted,
        chatId: chatId || undefined,
        toName: toName || undefined,
    });
}

async function sendWhatsAppMedia(
    instance: string,
    to: string,
    url: string,
    mediaType: string,
    caption?: string,
    leadId?: number | string,
) {
    const endpoint =
        mediaType === 'video' ? '/api/inbox/send_video' :
        mediaType === 'document' ? '/api/inbox/send_doc' :
        '/api/inbox/send_image';
    return post(endpoint, { id: instance, to, url, caption, lead_id: leadId });
}

async function sendWhatsAppAudio(instance: string, to: string, url: string, leadId?: number | string) {
    return post('/api/inbox/send_aud', { id: instance, to, url, lead_id: leadId });
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────
async function editWhatsAppMessage(instance: string, remoteJid: string, messageId: string, text: string) {
    return post('/api/inbox/edit_message', { id: instance, remoteJid, messageId, text });
}

async function blockWhatsAppContact(instance: string, remoteJid: string, block: boolean) {
    return post('/api/inbox/block_contact', { id: instance, remoteJid, block });
}

async function markWhatsAppAsRead(remoteJid: string, instanceName: string, messageId?: string) {
    return post('/api/inbox/mark_read', { remoteJid, instance: instanceName, messageId });
}

async function reactWhatsAppMessage(instance: string, remoteJid: string, messageId: string, emoji: string) {
    return post('/api/inbox/react_message', { id: instance, remoteJid, messageId, emoji });
}

async function deleteWhatsAppMessage(instance: string, remoteJid: string, messageId: string) {
    return post('/api/inbox/delete_message', { id: instance, remoteJid, messageId });
}

async function forwardWhatsAppMessage(instance: string, to: string, messagePayload: any) {
    return post('/api/inbox/forward_message', { id: instance, to, messagePayload });
}

// ─── PRESENCE ─────────────────────────────────────────────────────────────────
async function sendWhatsAppPresence(to: string, presence: string, instance: string) {
    return post('/api/inbox/send_presence', { to, presence, id: instance });
}

// ─── SYNC ─────────────────────────────────────────────────────────────────────
async function syncWhatsAppEvents(_after = 0) {
    // Endpoint not available in this backend — return empty event list silently
    return { ok: true, events: [], after: _after };
}

async function syncWhatsAppAvatar(jid: string, instanceName: string) {
    return post('/api/inbox/sync_avatar', { jid, instance: instanceName });
}

async function syncWhatsAppGroupMetadata(remoteJid: string, instanceName: string) {
    const res = await post('/api/inbox/get_group_meta', { sender: remoteJid, id: instanceName });
    return {
        ok: !!res?.success,
        subject: res?.data?.subject || res?.subject || null,
    };
}

// ─── LABELS ──────────────────────────────────────────────────────────────────
async function getWhatsAppLabels(_instanceName: string) {
    // Endpoint not available in this backend — return empty list silently
    return [];
}

// ─── CHAT MANAGEMENT ─────────────────────────────────────────────────────────
async function pinWhatsAppChat(chatId: number, pinned = true) {
    return post('/api/inbox/pin_chat', { chat_id: chatId, pinned });
}

async function muteWhatsAppChat(chatId: number, muted = true, until?: string) {
    return post('/api/inbox/mute_chat', { chat_id: chatId, muted, until });
}

async function archiveWhatsAppChat(chatId: number, archived = true) {
    return post('/api/inbox/archive_chat', { chat_id: chatId, archived });
}

async function deleteWhatsAppChat(chatId: number) {
    return post('/api/inbox/del_chat', { chat_id: chatId });
}

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
async function uploadFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/user/return_url', { method: 'POST', headers, body: form });
    return res.json();
}

// ─── INSTANCE EXTRAS ─────────────────────────────────────────────────────────
async function getInstanceErrors(instance: string, _limit = 50) {
    return post('/api/session/status', { id: instance });
}

async function getInstanceConfigs(instance: string) {
    return post('/api/session/status', { id: instance });
}

async function getInstanceMetrics(instance: string) {
    return post('/api/session/status', { id: instance });
}

async function updateInstanceConfigs(instance: string, data: any) {
    return post('/api/session/update_webhook_url', { id: instance, ...data });
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
export const api = {
    // generic
    get,
    post,
    put,
    delete: del,
    // auth
    login,
    // instances
    getWhatsAppInstances,
    createWhatsAppInstance,
    getWhatsAppQr,
    disconnectWhatsAppInstance,
    updateWhatsAppPhoto,
    // chats
    getWhatsAppChats,
    getWhatsAppContacts,
    getWhatsAppGroups,
    getWhatsAppHistory,
    // messaging
    sendWhatsAppText,
    sendWhatsAppMedia,
    sendWhatsAppAudio,
    // actions
    editWhatsAppMessage,
    blockWhatsAppContact,
    markWhatsAppAsRead,
    reactWhatsAppMessage,
    deleteWhatsAppMessage,
    forwardWhatsAppMessage,
    // presence
    sendWhatsAppPresence,
    // sync
    syncWhatsAppEvents,
    syncWhatsAppAvatar,
    syncWhatsAppGroupMetadata,
    // labels
    getWhatsAppLabels,
    // chat management
    pinWhatsAppChat,
    muteWhatsAppChat,
    archiveWhatsAppChat,
    deleteWhatsAppChat,
    // files
    uploadFile,
    // instance extras
    getInstanceErrors,
    getInstanceConfigs,
    getInstanceMetrics,
    updateInstanceConfigs,
    // instance management (Sessions page)
    deleteWhatsAppInstance,
    updateWhatsAppWebhook,
    getConnectedInstances: getWhatsAppInstances,
    getAICredentials: async (...args: any[]) => [],
    createAICredential: async (...args: any[]) => ({}),
    deleteAICredential: async (...args: any[]) => ({}),
    getAIBots: async (...args: any[]) => [],
    createAIBot: async (...args: any[]) => ({}),
    updateAIBot: async (...args: any[]) => ({}),
    deleteAIBot: async (...args: any[]) => ({}),
};
