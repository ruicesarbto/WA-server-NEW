import { create } from 'zustand';
import { WhatsAppInstance as Instance } from './types';
import { whatsappService } from '../../services/whatsappService';

export interface WhatsAppChatLabel {
    name: string;
    color_index: number;
    label_id: string;
}

export interface WhatsAppChat {
    id: number;
    chat_id?: string;       // base64-encoded chat key — used for get_convo
    instance_name: string;
    remote_jid: string;
    phone: string;
    lead_id: number | null;
    lead_name: string | null;
    lead_status: string | null;
    lead_email: string | null;
    lead_type: string | null;
    avatar_url: string | null;
    bio: string | null;
    subject?: string | null;
    displayName?: string | null;
    last_message_text: string | null;
    last_message_time: string | null;
    last_message_from_me?: number | null;
    last_message_status?: string | null;
    unread_count: number;
    labels?: WhatsAppChatLabel[];
    last_message_payload?: any;
    last_message_type?: string | null;
    last_message_participant_name?: string | null;
    is_pinned?: number | boolean | null;
    is_archived?: number | boolean | null;
    muted_until?: string | null;
}

export interface PresenceState {
    state: 'composing' | 'recording' | 'available';
    ts: number;
}

interface MessageUpsertPayload {
    remoteJid: string;
    text: string;
    timestampIso: string;
    fromMe: boolean;
    status?: 'pending' | 'sent' | 'delivered' | 'read';
    messageId?: string;
    messagePayload?: any;
    pushName?: string;
    instanceName?: string;
    messageType?: string;
    participantName?: string;
}

interface WhatsAppStoreState {
    // ─── INSTANCES ───
    instances: Instance[];
    saved: string[];
    instancesLoading: boolean;
    activeInstance: Instance | null;

    fetchInstances: (silent?: boolean) => Promise<void>;
    refreshInstances: () => Promise<void>;
    createInstance: (name: string) => Promise<{ ok: boolean, qr?: string }>;
    setActiveInstance: (instance: Instance | null) => void;

    // ─── CHATS ───
    chats: WhatsAppChat[];
    loadingChats: boolean;
    activeRemoteJid: string | null;
    presenceByJid: Record<string, PresenceState>;

    fetchChats: () => Promise<void>;
    setChats: (chats: WhatsAppChat[]) => void;
    patchChatById: (chatId: number | string, patch: Partial<WhatsAppChat>) => void;
    removeChatById: (chatId: number | string) => void;
    clearChats: () => void;
    handleChatSelect: (chat: WhatsAppChat) => Promise<void>;
    updateChatAvatar: (remoteJid: string, avatarUrl: string | null) => void;
    updateChatLastStatus: (remoteJid: string, status: string) => void;
    updateChatLastReaction: (remoteJid: string, reactionLine: string, timestampIso?: string, fromMe?: boolean) => void;
    upsertMessageEvent: (payload: MessageUpsertPayload) => boolean;
    upsertPresence: (remoteJid: string, presence: string) => void;
    updateGroupSubject: (remoteJid: string, subject: string) => void;
    syncGroupMetadata: (remoteJid: string, instance?: string) => Promise<void>;
}

function normalizeJid(jid: string): string {
    if (!jid) return '';
    const [user] = jid.split('@');
    const [cleanUser] = user.split(':');
    return cleanUser;
}

function toEpoch(value?: string | null): number {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
}

function dedupeChats(chats: WhatsAppChat[]): WhatsAppChat[] {
    const map = new Map<string, WhatsAppChat>();
    for (const chat of chats) {
        const key = normalizeJid(chat.remote_jid) || chat.remote_jid;
        const existing = map.get(key);
        // Mantém o que tiver a mensagem mais recente
        if (!existing || toEpoch(chat.last_message_time) > toEpoch(existing.last_message_time)) {
            map.set(key, chat);
        }
    }
    return Array.from(map.values());
}

/**
 * FASES 6 & 7 - Função de ordenação definitiva (Fixados primeiro, depois Tempo)
 */
function sortChats(chats: WhatsAppChat[]): WhatsAppChat[] {
    return [...chats].sort((a, b) => {
        const aPinned = Boolean(a.is_pinned);
        const bPinned = Boolean(b.is_pinned);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        
        const aTime = toEpoch(a.last_message_time);
        const bTime = toEpoch(b.last_message_time);
        return bTime - aTime;
    });
}

function prunePresence(presenceByJid: Record<string, PresenceState>, maxAgeMs = 6000): Record<string, PresenceState> {
    const now = Date.now();
    const next: Record<string, PresenceState> = {};
    for (const [jid, data] of Object.entries(presenceByJid)) {
        if (now - data.ts <= maxAgeMs) next[jid] = data;
    }
    return next;
}

const seenMessageIds = new Set<string>();
const seenMessageIdsQueue: string[] = [];
const MAX_SEEN_MESSAGES = 2000;

export const useWhatsAppStore = create<WhatsAppStoreState>((set, get) => ({
    // ─── INSTANCES ───
    instances: [],
    saved: [],
    instancesLoading: false,
    activeInstance: null,

    fetchInstances: async (silent = false) => {
        if (!silent) set({ instancesLoading: true });
        try {
            const data = await whatsappService.getInstances();
            
            // Garantir que data existe e tem o formato esperado
            if (!data || !data.instances) {
                console.warn('[W3:STORE] Resposta de instâncias vazia ou inválida');
                return;
            }

            const newInstances = data.instances || [];
            const newSaved = data.saved || [];

            set((state) => {
                // Previne re-render se os dados de instâncias e IDs salvos forem idênticos
                const hasInstancesChanged = JSON.stringify(state.instances) !== JSON.stringify(newInstances.map(ni => {
                    // Preservar avatar local se o novo for nulo para evitar piscamento
                    const existing = state.instances.find(i => i.instance === ni.instance);
                    if (!ni.avatar && existing?.avatar) {
                        return { ...ni, avatar: existing.avatar };
                    }
                    return ni;
                }));
                const hasSavedChanged = JSON.stringify(state.saved) !== JSON.stringify(newSaved);

                if (!hasInstancesChanged && !hasSavedChanged) {
                    return state;
                }

                // Aplicar persistência de avatar na atualização final
                const instancesWithAvatarPersistence = newInstances.map(ni => {
                    const existing = state.instances.find(i => i.instance === ni.instance);
                    if (!ni.avatar && existing?.avatar) {
                        return { ...ni, avatar: existing.avatar };
                    }
                    return ni;
                });

                return {
                    instances: instancesWithAvatarPersistence,
                    saved: newSaved
                };
            });
        } catch (error) {
            console.warn('[W3:STORE] Falha ao carregar instâncias (Endpoint Offline ou 404)');
            // Previne falha crítica na UI
            set({ instances: [], instancesLoading: false });
        } finally {
            if (!silent) set({ instancesLoading: false });
        }
    },

    refreshInstances: async () => {
        await get().fetchInstances();
    },

    createInstance: async (name: string) => {
        const res = await whatsappService.createInstance(name);
        await get().fetchInstances();
        return res;
    },

    setActiveInstance: (instance: Instance | null) => {
        if (typeof window !== 'undefined') {
            if (instance?.instance) {
                localStorage.setItem('instance_name', instance.instance);
            } else {
                localStorage.removeItem('instance_name');
            }
        }
        set({ activeInstance: instance, chats: [] });
    },

    // ─── CHATS ───
    chats: [],
    loadingChats: false,
    activeRemoteJid: null,
    presenceByJid: {},

    setChats: (chats: WhatsAppChat[]) => {
        set({ chats: sortChats(dedupeChats(chats)) });
    },

    patchChatById: (id: number | string, patch: Partial<WhatsAppChat>) => {
        set((state) => ({
            chats: state.chats.map((chat) => (
                (chat.id === id || normalizeJid(chat.remote_jid) === normalizeJid(String(id))) ? { ...chat, ...patch } : chat
            )),
        }));
    },

    removeChatById: (id: number | string) => {
        set((state) => ({
            chats: state.chats.filter((chat) => chat.id !== id && normalizeJid(chat.remote_jid) !== normalizeJid(String(id))),
        }));
    },

    fetchChats: async () => {
        const { activeInstance } = get();
        if (!activeInstance) return;
        set({ loadingChats: true });
        try {
            // Busca tripla: Chats, Contatos e Grupos em paralelo
            const [chatsRes, contactsRes, groupsRes] = await Promise.all([
                whatsappService.getChats(activeInstance.instance),
                whatsappService.getContacts(activeInstance.instance).catch(() => ({ contacts: [] })),
                whatsappService.getGroups(activeInstance.instance).catch(() => ({ groups: [] }))
            ]);

            const chatsRaw = chatsRes?.chats || [];
            const contactsRaw = contactsRes?.contacts || [];
            const groupsRaw = groupsRes?.groups || [];

            // Mapa de Contatos (para resolver nomes de chats privados)
            const contactMap: Record<string, string> = {};
            contactsRaw.forEach((c: any) => {
                const id = c.id || c.remoteJid;
                if (id) contactMap[id] = c.pushName || c.name || '';
            });

            // Mapa de Grupos (para resolver nomes de grupos)
            const groupMap: Record<string, string> = {};
            groupsRaw.forEach((g: any) => {
                const id = g.id || g.remoteJid;
                if (id) groupMap[id] = g.subject || '';
            });

            // FASES 4 & 5 - Resolução de Nomes e Normalização
            const normalizedChats = chatsRaw.map((chat: WhatsAppChat) => {
                const rJid = String(chat.remote_jid || chat.id || '');
                const isGroup = rJid.endsWith('@g.us');
                
                let displayName = '';
                if (isGroup) {
                    displayName = groupMap[rJid] || chat.subject || chat.lead_name || chat.phone || 'Grupo';
                } else {
                    // Ordem de prioridade: Agenda (contactMap) > CRM (lead_name) > PushName/Subject > Telefone
                    displayName = contactMap[rJid] || chat.lead_name || chat.subject || chat.phone || rJid.split('@')[0];
                }

                return {
                    ...chat,
                    remote_jid: rJid,
                    displayName: displayName
                };
            });

            // FASES 6 & 7 - Avançar chats com mensagem e Ordenar
            // FASES 6 & 7 - Aplicar Ordenação na Store
            get().setChats(normalizedChats);
        } catch (error) {
            console.error('[W3:STORE] Falha ao carregar chats:', error);
        } finally {
            set({ loadingChats: false });
        }
    },


    clearChats: () => set({ chats: [], activeRemoteJid: null, presenceByJid: {} }),

    handleChatSelect: async (chat: WhatsAppChat) => {
        const target = normalizeJid(chat.remote_jid);
        set((state) => ({
            activeRemoteJid: target,
            chats: state.chats.map((c) =>
                normalizeJid(c.remote_jid) === target ? { ...c, unread_count: 0 } : c
            ),
        }));

        try {
            await whatsappService.markAsRead(chat.remote_jid, chat.instance_name);
        } catch (err) {
            console.warn('[Inbox] mark_as_read failed:', err);
        }
    },

    updateChatAvatar: (remoteJid: string, avatarUrl: string | null) => {
        const target = normalizeJid(remoteJid);
        set((state) => ({
            chats: state.chats.map((c) =>
                normalizeJid(c.remote_jid) === target ? { ...c, avatar_url: avatarUrl } : c
            ),
        }));
    },

    updateChatLastStatus: (remoteJid: string, status: string) => {
        const target = normalizeJid(remoteJid);
        if (!target) return;
        set((state) => ({
            chats: state.chats.map((c) =>
                normalizeJid(c.remote_jid) === target
                    ? { ...c, last_message_status: status }
                    : c
            ),
        }));
    },

    updateChatLastReaction: (remoteJid: string, reactionLine: string, timestampIso?: string, fromMe?: boolean) => {
        const target = normalizeJid(remoteJid);
        if (!target) return;
        const when = timestampIso || new Date().toISOString();
        const state = get();
        const index = state.chats.findIndex((c) => normalizeJid(c.remote_jid) === target);
        if (index === -1) return;
        
        const updatedChats = [...state.chats];
        const [chat] = updatedChats.splice(index, 1);
        const updated: WhatsAppChat = {
            ...chat,
            last_message_text: reactionLine || chat.last_message_text,
            last_message_time: when,
            last_message_from_me: typeof fromMe === 'boolean' ? (fromMe ? 1 : 0) : chat.last_message_from_me,
            last_message_payload: {
                ...(chat.last_message_payload || {}),
                reactionSummary: true,
            },
        };
        set({ chats: [updated, ...updatedChats] });
    },

    upsertMessageEvent: ({ remoteJid, text, timestampIso, fromMe, status, messagePayload, pushName, messageId, instanceName, messageType, participantName }: MessageUpsertPayload) => {
        const target = normalizeJid(remoteJid);
        if (!target) return false;

        if (messageId) {
            if (seenMessageIds.has(messageId)) return true;
            seenMessageIds.add(messageId);
            seenMessageIdsQueue.push(messageId);
            if (seenMessageIdsQueue.length > MAX_SEEN_MESSAGES) {
                const oldest = seenMessageIdsQueue.shift();
                if (oldest) seenMessageIds.delete(oldest);
            }
        }

        const state = get();
        const index = state.chats.findIndex((c) => normalizeJid(c.remote_jid) === target);
        
        if (index === -1) {
            const fallbackPhone = target.replace(/\D/g, '') || target;
            const isNewGroupJid = remoteJid.endsWith('@g.us');
            const newChat: WhatsAppChat = {
                id: -Date.now(),
                instance_name: instanceName || 'main',
                remote_jid: remoteJid,
                phone: fallbackPhone,
                lead_id: null,
                lead_name: null,
                lead_status: null,
                lead_email: null,
                lead_type: null,
                avatar_url: null,
                bio: null,
                subject: isNewGroupJid ? fallbackPhone : (pushName || fallbackPhone),
                displayName: isNewGroupJid ? fallbackPhone : (pushName || fallbackPhone),
                last_message_text: text || 'Midia',
                last_message_time: timestampIso,
                last_message_from_me: fromMe ? 1 : 0,
                last_message_status: status || (fromMe ? 'sent' : 'delivered'),
                unread_count: fromMe ? 0 : 1,
                labels: [],
                last_message_payload: messagePayload || null,
                last_message_type: messageType || (text ? 'text' : null),
                last_message_participant_name: participantName || null,
            };

            set({
                chats: [newChat, ...state.chats],
                presenceByJid: prunePresence(state.presenceByJid),
            });
            return true;
        }

        const updatedChats = [...state.chats];
        const [chat] = updatedChats.splice(index, 1);
        const shouldIncUnread = !fromMe && state.activeRemoteJid !== target;

        const rJid = String(remoteJid || chat.remote_jid);
        const isGroupJid = rJid.endsWith('@g.us');
        
        // FASE 8 - Atualizar e mover para o topo (sortChats gerencia a ordem final)
        const updated: WhatsAppChat = {
            ...chat,
            remote_jid: rJid,
            subject: isGroupJid ? chat.subject : (pushName || chat.subject || chat.phone),
            displayName: isGroupJid ? (chat.displayName || chat.subject) : (pushName || chat.displayName || chat.subject || chat.phone),
            last_message_text: text || chat.last_message_text || 'Midia',
            last_message_time: timestampIso,
            last_message_from_me: fromMe ? 1 : 0,
            last_message_status: status || chat.last_message_status || (fromMe ? 'sent' : 'delivered'),
            last_message_payload: messagePayload || chat.last_message_payload,
            last_message_type: messageType || chat.last_message_type || (text ? 'text' : null),
            last_message_participant_name: participantName || chat.last_message_participant_name,
            unread_count: shouldIncUnread ? (chat.unread_count || 0) + 1 : chat.unread_count,
        };

        const finalChats = [updated, ...updatedChats];
        set({
            chats: sortChats(finalChats),
            presenceByJid: prunePresence(state.presenceByJid),
        });
        return true;
    },

    upsertPresence: (remoteJid: string, presence: string) => {
        const target = normalizeJid(remoteJid);
        if (!target) return;
        const normalized =
            String(presence || '').toLowerCase().includes('record') ? 'recording' :
                String(presence || '').toLowerCase().includes('compos') ? 'composing' :
                    'available';
        const state = get();
        set({
            presenceByJid: {
                ...prunePresence(state.presenceByJid),
                [target]: { state: normalized as any, ts: Date.now() },
            },
        });
    },

    updateGroupSubject: (remoteJid: string, subject: string) => {
        const target = normalizeJid(remoteJid);
        if (!target) return;
        set((state) => ({
            chats: state.chats.map((c) =>
                normalizeJid(c.remote_jid) === target
                    ? { ...c, subject, displayName: subject }
                    : c
            ),
        }));
    },

    syncGroupMetadata: async (remoteJid: string, instance = 'main') => {
        const target = normalizeJid(remoteJid);
        if (!target) return;
        try {
            const res = await whatsappService.syncGroupMetadata(remoteJid, instance);
            if (res.ok && res.subject) {
                get().updateGroupSubject(remoteJid, res.subject);
            }
        } catch (err) {
            console.warn('[Inbox] syncGroupMetadata failed:', err);
        }
    },
}));

export const getState = () => useWhatsAppStore.getState();

let pollingInterval: any = null;
let pollingStarted = false;

export const startInstancePolling = (intervalMs = 5000) => {
    if (pollingStarted) return;
    pollingStarted = true;
    
    // Primeira execução imediata
    useWhatsAppStore.getState().fetchInstances(true);
    
    pollingInterval = setInterval(() => {
        useWhatsAppStore.getState().fetchInstances(true);
    }, intervalMs);
};

export const stopInstancePolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        pollingStarted = false;
    }
};
