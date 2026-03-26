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
    const liveMap: Record<string, any> = {};
    try {
        const liveRes = await get('/api/session/get_instances_with_status');
        const liveItems: any[] = liveRes?.data || [];
        liveItems.forEach((item: any) => {
            const id = item?.i?.instance_id;
            if (id) {
                liveMap[id] = item;
            }
        });
    } catch { /* ignore — fall back to DB status */ }

    // Fetch profile images for authenticated instances in parallel
    const authenticatedIds = new Set<string>();
    Object.entries(liveMap).forEach(([id, item]) => {
        if (item.status === true) authenticatedIds.add(id);
    });

    const avatarMap: Record<string, string | null> = {};
    await Promise.all(
        allRaw
            .filter(r => authenticatedIds.has(r.instance_id))
            .map(async (r) => {
                try {
                    const res = await post('/api/session/get_profile_image', { instance_id: r.instance_id });
                    avatarMap[r.instance_id] = res?.profileImage || null;
                } catch { avatarMap[r.instance_id] = null; }
            })
    );

    const instances = allRaw.map((r: any) => {
        const rawUd = r.userdata ?? r.userData;
        const userData = typeof rawUd === 'string' ? (() => { try { return JSON.parse(rawUd); } catch { return null; } })() : (rawUd || null);
        const live = liveMap[r.instance_id];
        const liveUser = live?.userData || userData;
        const isAuthenticated = live?.status === true;
        const baileysState = live?.state || null; // 'authenticated', 'connecting', 'disconnected', etc.
        const jid = r.jid || liveUser?.id?.split(':')[0] || '';

        // Avatar: CDN live > userData do DB > DB column
        const avatar = avatarMap[r.instance_id] || liveUser?.imgUrl || userData?.imgUrl || r.profile_pic || null;

        // Map Baileys state para status do frontend
        let status: string;
        if (isAuthenticated || baileysState === 'authenticated') {
            status = 'connected';
        } else if (baileysState === 'connecting') {
            status = 'connecting';
        } else if (r.status === 'CONNECTED') {
            // DB diz CONNECTED mas Baileys ainda está reconectando
            status = 'connecting';
        } else {
            status = 'disconnected';
        }

        return {
            instance: r.instance_id,
            status,
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

async function deleteWhatsAppInstance(name: string, mode?: string) {
    return post('/api/session/del_ins', { id: name, mode });
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
    // New PG schema: chats table with columns: id, chat_id, instance_id, uid,
    //   sender_name, sender_jid, profile_image, chat_status, is_pinned, is_muted,
    //   is_read, unread_count, last_message (TEXT), last_message_at (TIMESTAMPTZ),
    //   last_message_type, group_metadata, etc.
    const raw: any[] = res?.data || [];
    const chats = raw.map((r: any) => {
        // last_message is now a plain TEXT column (not JSON)
        let lastMsgText: string | null = r.last_message || null;
        const lastMsgType = r.last_message_type || 'text';

        // Show type labels for media messages with no text
        if (!lastMsgText && lastMsgType !== 'text') {
            const t = String(lastMsgType).toLowerCase();
            if (t === 'image') lastMsgText = 'Imagem';
            else if (t === 'video') lastMsgText = 'Video';
            else if (t === 'audio' || t === 'ptt') lastMsgText = 'Audio';
            else if (t === 'document') lastMsgText = 'Documento';
            else if (t === 'sticker') lastMsgText = 'Figurinha';
            else lastMsgText = `[${lastMsgType}]`;
        }

        // last_message_at is ISO/TIMESTAMPTZ — use directly
        const lastMsgTime: string | null = r.last_message_at
            ? new Date(r.last_message_at).toISOString()
            : null;

        const jid = r.sender_jid || r.chat_id || '';
        const phone = jid.split('@')[0] || '';
        const name = r.sender_name || null;

        return {
            id: r.id,
            chat_id: r.chat_id || null,
            instance_name: r.instance_id || instance,
            remote_jid: jid,
            phone,
            lead_id: null,
            lead_name: name,
            lead_status: r.chat_status || null,
            lead_email: null,
            lead_type: null,
            avatar_url: r.profile_image || null,
            bio: null,
            subject: jid.endsWith('@g.us') ? (r.sender_name || null) : null,
            displayName: name || phone || jid.split('@')[0] || null,
            last_message_text: lastMsgText,
            last_message_time: lastMsgTime,
            last_message_from_me: null,   // not tracked at chat level yet
            last_message_status: null,
            last_message_type: lastMsgType,
            unread_count: r.unread_count || 0,
            labels: [],
            is_pinned: r.is_pinned ? 1 : 0,
            is_archived: r.chat_status === 'archived' ? 1 : 0,
            muted_until: r.is_muted ? '2099-01-01' : null,
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
    chatId?: string,
    cursor?: string | null,
) {
    // Cursor-based pagination from PostgreSQL messages table.
    // cursor = ISO timestamp of oldest message on screen (for "load more").
    // First load: no cursor → newest 50 messages.
    const body: any = {
        chatId: remoteJid || chatId,
        instanceId: instance,
        limit,
    };
    if (cursor) body.cursor = cursor;

    const res = await post('/api/user/get_convo', body);

    // Backend returns rows in chronological order (already reversed from DESC)
    // Columns: msg_id, chat_id, sender_jid, sender_name, from_me, msg_type,
    //          msg_body, msg_data, media_url, quoted_msg_id, quoted_sender,
    //          status, route, reaction, is_starred, message_timestamp
    const rawMsgs: any[] = Array.isArray(res?.data) ? res.data : [];
    const messages = rawMsgs.map((r: any, idx: number) => {
        const ts = r.message_timestamp
            ? new Date(r.message_timestamp).toISOString()
            : new Date().toISOString();
        const msgData = typeof r.msg_data === 'string'
            ? (() => { try { return JSON.parse(r.msg_data); } catch { return null; } })()
            : (r.msg_data || null);

        return {
            id: idx,
            chat_id: 0,
            message_id: r.msg_id || `${ts}-${idx}`,
            text: r.msg_body || '',
            type: r.msg_type || 'text',
            direction: r.from_me ? 'out' : 'in',
            status: r.status || (r.from_me ? 'sent' : 'delivered'),
            timestamp: ts,
            media_url: r.media_url || msgData?.url || null,
            media_type: r.msg_type !== 'text' ? r.msg_type : undefined,
            reactions: r.reaction ? { [r.reaction]: r.reaction } : null,
            message_payload: r,
            participant: r.sender_name || null,
            quoted_message_id: r.quoted_msg_id || null,
            quoted_participant: r.quoted_sender || null,
        };
    });

    return {
        messages,
        hasMore: res?.hasMore || false,
        nextCursor: res?.nextCursor || null,
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
    const res = await post('/api/session/sync_group_metadata', { remote_jid: remoteJid, instance: instanceName });
    return {
        ok: !!res?.ok,
        subject: res?.subject || null,
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
