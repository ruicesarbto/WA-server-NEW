import { getAccessToken } from '@/lib/auth-cookies';
import { format, isToday, isYesterday, isWithinInterval, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const normalizeJid = (jid: string) => {
    if (!jid) return '';
    const [user] = jid.split('@');
    const [cleanUser] = user.split(':');
    return cleanUser;
};

export const formatPhone = (phone: string, remoteJid?: string) => {
    const raw = String(phone || '').trim();
    const isLid = String(remoteJid || '').endsWith('@lid');
    if (isLid) {
        const id = normalizeJid(String(remoteJid || '')) || raw;
        return `ID privado (${id})`;
    }
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length === 12 || cleaned.length === 13) {
        return cleaned.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, '+$1 $2 $3-$4');
    }
    if (cleaned.length >= 10 && cleaned.length <= 15) {
        return `+${cleaned}`;
    }
    return raw || cleaned;
};

export const getAvatarInitials = (chat: any) => {
    const name = chat.displayName || chat.subject || chat.phone || '';
    return name.slice(0, 2).toUpperCase();
};

export const getAvatarColor = (id: string) => {
    const colors = [
        '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
        '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
        '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12',
        '#d35400', '#c0392b', '#7f8c8d'
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const getLabelColor = (index: number) => {
    const colors = [
        'bg-gray-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500',
        'bg-green-500', 'bg-teal-500', 'bg-blue-500', 'bg-indigo-500',
        'bg-purple-500', 'bg-pink-500'
    ];
    return colors[index % colors.length] || 'bg-gray-500';
};

export const getMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `/api/storage/view/${url}`;
};

export const getAvatarProxyUrl = (chat: any, type: 'instance' | 'contact' = 'contact'): string | null => {
    // Pegamos a URL base do backend (em produção deve ser injetada via env)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

    if (type === 'instance') {
        const direct = chat.avatar || chat.profilePictureUrl || null;
        if (!direct) return null;
        // Se for caminho local do nosso cache — usar relativo (Next.js proxy faz /media/ → backend)
        if (direct.startsWith('avatars/')) {
            return `/media/${direct}`;
        }
        return direct;
    }

    const direct = chat.avatar_url || null;
    if (!direct) return null;

    // Se for caminho local do nosso cache — usar relativo (Next.js proxy faz /media/ → backend)
    if (direct.startsWith('avatars/')) {
        return `/media/${direct}`;
    }

    return direct;
};

export const isGenericGroupSubject = (subject: string, phone: string, remoteJid: string) => {
    if (!remoteJid || !remoteJid.endsWith('@g.us')) return false;
    const s = String(subject || '').trim();
    if (!s || s === 'Grupo' || s === 'WhatsApp Group') return true;
    if (s === phone) return true;
    const jidUser = String(remoteJid || '').split('@')[0];
    if (s === jidUser) return true;
    return false;
};
export const normalizeMessageRow = (row: any): any => {
    let reactions: Record<string, string> | null = null;
    if (row?.reactions && typeof row.reactions === 'object') {
        reactions = row.reactions as Record<string, string>;
    } else if (typeof row?.reactions === 'string') {
        try {
            const parsed = JSON.parse(row.reactions);
            reactions = parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            reactions = null;
        }
    }

    const payload = typeof row?.message_payload === 'string'
        ? (() => {
            try { return JSON.parse(row.message_payload); } catch { return null; }
        })()
        : (row?.message_payload || null);

    const payloadCtx =
        payload?.extendedTextMessage?.contextInfo ||
        payload?.imageMessage?.contextInfo ||
        payload?.videoMessage?.contextInfo ||
        payload?.documentMessage?.contextInfo ||
        payload?.contextInfo ||
        null;
    const payloadQuotedText = payloadCtx?.quotedMessage
        ? (
            payloadCtx?.quotedMessage?.conversation ||
            payloadCtx?.quotedMessage?.extendedTextMessage?.text ||
            payloadCtx?.quotedMessage?.imageMessage?.caption ||
            payloadCtx?.quotedMessage?.videoMessage?.caption ||
            payloadCtx?.quotedMessage?.documentMessage?.caption ||
            null
        )
        : null;

    return {
        ...row,
        quoted_id: row?.quoted_id || payloadCtx?.stanzaId || null,
        quoted_message_id: row?.quoted_message_id || row?.quoted_id || payloadCtx?.stanzaId || null,
        quoted_message_text: row?.quoted_message_text || payloadQuotedText || null,
        quoted_participant: row?.quoted_participant || payloadCtx?.participant || null,
        reactions,
        message_payload: payload,
        participant: row?.participant || payload?.key?.participant || payload?.participant || null,
        status: row?.status || (row?.direction === 'out' ? 'sent' : 'pending'),
    };
};

export const formatChatDate = (timestamp: string | number | Date | null | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    if (isToday(date)) {
        return format(date, 'HH:mm');
    }

    if (isYesterday(date)) {
        return 'Ontem';
    }

    const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
    if (isWithinInterval(date, { start: sevenDaysAgo, end: new Date() })) {
        return format(date, 'eeee', { locale: ptBR });
    }

    return format(date, 'dd/MM/yyyy');
};

export const getMediaPreview = (type: string, text?: string) => {
    switch (type) {
        case 'image': return { icon: '📷', label: text || 'Foto' };
        case 'video': return { icon: '🎥', label: text || 'Vídeo' };
        case 'audio':
        case 'ptt': return { icon: '🎤', label: 'Mensagem de voz' };
        case 'document': return { icon: '📄', label: text || 'Documento' };
        case 'sticker': return { icon: '✨', label: 'Figurinha' };
        case 'location': return { icon: '📍', label: 'Localização' };
        case 'contact': return { icon: '👤', label: 'Contato' };
        default: return null;
    }
};
