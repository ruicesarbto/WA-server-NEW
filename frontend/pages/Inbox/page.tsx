'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
    Search,
    MoreVertical,
    ArrowLeft,
    Send,
    MessageCircle,
    Check,
    CheckCheck,
    Phone,
    User,
    Clock,
    Filter,
    X,
    MessageSquare,
    Image as ImageIcon,
    Video,
    FileText,
    Mic,
    Paperclip,
    Smile,
    ArrowDown,
    Tag,
    ChevronDown,
    Settings,
    LogOut,
    HelpCircle,
    RefreshCw,
    Reply,
    Forward,
    Star,
    Trash2,
    MessageSquarePlus,
    Lock,
    VolumeX,
    Pin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io as socketIO } from 'socket.io-client';
import { whatsappService } from '../../services/whatsappService';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWhatsAppStore, getState, startInstancePolling, stopInstancePolling, type WhatsAppChat } from './whatsappStore';
import { useChatStore } from "@/store/chatStore";

import { Message, WhatsAppInstance } from './types';
import ChatSidebar from './ChatSidebar';
import ThinSidebar, { TabType } from './ThinSidebar';

import {
    normalizeJid,
    formatPhone,
    getAvatarInitials,
    getAvatarColor,
    getLabelColor,
    normalizeMessageRow,
    getAvatarProxyUrl
} from './utils';

import InboxHeader from './components/InboxHeader';
import MessageArea from './components/MessageArea';
import InputBar from './components/InputBar';
import NewConversationModal from './components/NewConversationModal';

type Chat = WhatsAppChat;

interface Label {
    id: number;
    label_id: string;
    name: string;
    color_index: number;
}


// Message interface removed and moved to types.ts

interface HistoryFilters {
    search?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
}

interface CustomChatList {
    id: string;
    name: string;
    jids: string[];
}

type ChatScope = 'inbox' | 'favorites' | 'archived' | 'custom_list';

// normalizeMessageRow moved to utils.ts

export default function WhatsAppInboxPage() {
    const { user } = useAuth();
    const router = useRouter();
    // Core states
    const initialized = useRef<string | boolean>(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('chats');
    const [msgLoading, setMsgLoading] = useState(false);
    const [historyCursor, setHistoryCursor] = useState<string | null>(null);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
    const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({});
    
    // Store Hooks (Move to top to avoid Temporal Dead Zone errors)
    const instances = useWhatsAppStore(useShallow((s) => s.instances));
    const activeInstance = useWhatsAppStore(useShallow((s) => s.activeInstance));
    const setActiveInstance = useWhatsAppStore((s) => s.setActiveInstance);
    const refreshInstances = useWhatsAppStore((s) => s.refreshInstances);
    
    // New Store-based states
    const activeChatId = useChatStore((state: any) => (state as any).activeChatId);
    const setActiveChat = useChatStore((state: any) => (state as any).setActiveChat);
    const chats = useWhatsAppStore(useShallow((state) => state.chats));
    const messages = useChatStore(useShallow((state: any) => (state as any).messages[activeChatId] || []));
    const selectedChat = useMemo(() => chats.find(c => c.remote_jid === activeChatId) || null, [chats, activeChatId]);
    
    // Store Actions / Compatibility Aliases
    const patchChatById = useWhatsAppStore((state) => state.patchChatById);
    const removeChatById = useWhatsAppStore((state) => state.removeChatById);
    const setChats = useWhatsAppStore((state) => state.setChats);
    const clearChats = useWhatsAppStore((state) => state.clearChats);
    
    const fetchChatsStore = useCallback(async () => {
        if (!activeInstance?.instance) return;
        try {
            const data = await whatsappService.getChats(activeInstance.instance);
            if (data?.chats) {
                // Ensure each chat has an 'id' for the store map
                const mapped = data.chats.map((c: any) => ({
                    ...c,
                    id: c.id || c.remote_jid || c.remoteJid
                }));
                setChats(mapped);
            }
        } catch (error) {
            console.error('[FetchChats] Error:', error);
        }
    }, [activeInstance, setChats]);

    const handleChatSelectStore = useCallback(async (chat: any) => setActiveChat(chat.remote_jid), [setActiveChat]);
    const upsertMessageEvent = useWhatsAppStore((state) => state.upsertMessageEvent);
    const updateChatAvatar = useCallback((jid: string, url: string) => patchChatById(jid, { avatar_url: url }), [patchChatById]);
    const updateChatLastStatus = useCallback((jid: string, status: string, ...args: any[]) => patchChatById(jid, { last_message_status: status }), [patchChatById]);
    const updateChatLastReaction = useCallback((jid: string, emoji: string, ...args: any[]) => patchChatById(jid, { last_message_text: `Reação: ${emoji}` }), [patchChatById]);
    const updateGroupSubject = useCallback((jid: string, subject: string, ...args: any[]) => patchChatById(jid, { subject }), [patchChatById]);
    const syncGroupMetadata = useCallback(async (remoteJid: string, instance?: string) => {
        if (!activeInstance?.instance) return;
        try {
            const res = await whatsappService.syncGroupMetadata(remoteJid, instance || activeInstance.instance);
            if (res.ok && res.subject) {
                patchChatById(remoteJid, { subject: res.subject });
            }
        } catch {}
    }, [activeInstance, patchChatById]);
    
    // Compatibility setters (mapping to store where possible, ornoop)
    const setSelectedChat = useCallback((chat: any) => {
        if (typeof chat === 'function') {
            // Complex case, but usually setSelectedChat(null) or similar
            return;
        }
        if (chat?.id) setActiveChat(chat.id);
        else if (chat === null) setActiveChat(null);
    }, [setActiveChat]);
    
    const updateMessagesStore = useChatStore((state: any) => (state as any).setMessages);
    const setMessages = useCallback((msgs: any) => {
        if (!activeChatId) return;
        if (typeof msgs === 'function') {
            const current = useChatStore.getState().messages[activeChatId] || [];
            updateMessagesStore(activeChatId, msgs(current));
        } else {
            updateMessagesStore(activeChatId, msgs);
        }
    }, [activeChatId, updateMessagesStore]);

    // UI Helpers from legacy store (or local equivalents)
    const [presenceByJid, setPresenceByJid] = useState<Record<string, any>>({});
    const upsertPresence = useCallback((jid: string, presence: any, ...args: any[]) => {
        setPresenceByJid(prev => ({ ...prev, [jid]: presence }));
    }, []);

    // Other Re-enabled states
    const [searchTerm, setSearchTerm] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
    const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    // Filter counts (mock for now or based on real chats if possible)
    const filterCounts = useMemo(() => ({
        all: chats.length,
        unread: chats.filter(c => c.unread_count > 0).length,
        groups: chats.filter(c => c.remote_jid.endsWith('@g.us')).length,
        pinned: chats.filter(c => c.is_pinned).length,
        muted: chats.filter(c => c.muted_until && new Date(c.muted_until).getTime() > Date.now()).length,
        marked: 0,
        archived: chats.filter(c => c.is_archived).length,
    }), [chats]);
    const [chatScope, setChatScope] = useState<ChatScope>('inbox');
    const [favoriteJids, setFavoriteJids] = useState<string[]>([]);
    const [customLists, setCustomLists] = useState<CustomChatList[]>([]);
    const [activeCustomListId, setActiveCustomListId] = useState<string | null>(null);
    const [isInstanceDropdownOpen, setIsInstanceDropdownOpen] = useState(false);
    const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
    const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [drafts, setDrafts] = useState<Record<string, string>>({}); // JID -> text
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
    const [messageToForward, setMessageToForward] = useState<Message | null>(null);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isSyncingAvatar, setIsSyncingAvatar] = useState(false);
    const [menuOpenChatId, setMenuOpenChatId] = useState<number | null>(null);
    const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});
    const [instanceAvatarErrors, setInstanceAvatarErrors] = useState<Record<string, boolean>>({});
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
    const [isNewConvoModalOpen, setIsNewConvoModalOpen] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const pendingSelectPhoneRef = useRef<string | null>(null);
    const prependingHistoryRef = useRef(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Ref síncrono para gate de presence — evita stale closure entre setIsTyping e re-render
    const isTypingRef = useRef(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionsRef = useRef<HTMLDivElement>(null);
    const chatOptionsRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const syncCursorRef = useRef<number>(0);
    const syncInFlightRef = useRef(false);
    const lastSyncErrorLogAtRef = useRef(0);
    const syncFailureStreakRef = useRef(0);
    const syncPollDelayMsRef = useRef(1500);
    const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
    const chatsRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const historyRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const handleSocketEventRef = useRef<((event: string, data: any) => void) | null>(null);
    const queueChatsRefreshRef = useRef<((delay?: number) => void) | null>(null);
    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    
    const activeInstanceRef = useRef(activeInstance);
    useEffect(() => {
        activeInstanceRef.current = activeInstance;
    }, [activeInstance]);

    const storageKeyPrefix = useMemo(() => `whatsapp_v3_inbox:${user?.uid || 'anon'}`, [user?.uid]);
    const selectedList = useMemo(
        () => customLists.find((list) => list.id === activeCustomListId) || null,
        [customLists, activeCustomListId]
    );
    const selectedListSet = useMemo(() => new Set(selectedList?.jids || []), [selectedList]);
    const favoriteSet = useMemo(() => new Set(favoriteJids), [favoriteJids]);

    const connectedInstances = useMemo(() =>
        instances.filter(i => ['connected', 'open', 'authenticated'].includes(i.status || ''))
            .map(i => ({
                id: i.instance,
                nome: i.nome || i.instance,
                avatar: i.avatar || i.profilePictureUrl || null,
                phone: i.phone || null
            })),
        [instances]
    );

    const mappedActiveInstance = useMemo(() => {
        if (!activeInstance) return null;
        return {
            id: activeInstance.instance,
            nome: activeInstance.nome || activeInstance.instance,
            avatar: activeInstance.avatar || activeInstance.profilePictureUrl || null,
            phone: activeInstance.phone || null
        };
    }, [activeInstance]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const favRaw = window.localStorage.getItem(`${storageKeyPrefix}:favorites`);
            const listsRaw = window.localStorage.getItem(`${storageKeyPrefix}:lists`);
            const parsedFav = favRaw ? JSON.parse(favRaw) : [];
            const parsedLists = listsRaw ? JSON.parse(listsRaw) : [];
            setFavoriteJids(Array.isArray(parsedFav) ? parsedFav : []);
            setCustomLists(Array.isArray(parsedLists) ? parsedLists : []);
        } catch {
            setFavoriteJids([]);
            setCustomLists([]);
        }
    }, [storageKeyPrefix]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(`${storageKeyPrefix}:favorites`, JSON.stringify(favoriteJids));
    }, [favoriteJids, storageKeyPrefix]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(`${storageKeyPrefix}:lists`, JSON.stringify(customLists));
    }, [customLists, storageKeyPrefix]);

    useEffect(() => {
        if (!activeCustomListId) return;
        const exists = customLists.some((list) => list.id === activeCustomListId);
        if (!exists) setActiveCustomListId(null);
    }, [activeCustomListId, customLists]);

    const isFavoriteChat = useCallback((chat: Chat) => {
        const key = normalizeJid(chat.remote_jid) || chat.remote_jid;
        return favoriteSet.has(key);
    }, [favoriteSet]);

    const chatsByScope = useMemo(() => {
        let base = chats;
        if (chatScope === 'favorites') {
            base = base.filter((chat) => favoriteSet.has(normalizeJid(chat.remote_jid) || chat.remote_jid));
        } else if (chatScope === 'archived') {
            base = base.filter((chat) => Boolean(chat.is_archived));
        } else if (chatScope === 'custom_list') {
            if (!selectedList) return [];
            base = base.filter((chat) => selectedListSet.has(normalizeJid(chat.remote_jid) || chat.remote_jid));
        } else {
            // Default inbox - excludes archived
            base = base.filter((chat) => !Boolean(chat.is_archived));
        }

        // Apply activeFilter (from Image 2 dropdown)
        if (activeFilter === 'unread') {
            return base.filter(c => c.unread_count > 0);
        }
        if (activeFilter === 'groups') {
            return base.filter(c => c.remote_jid.endsWith('@g.us'));
        }
        if (activeFilter === 'pinned') {
            return base.filter(c => c.is_pinned);
        }
        if (activeFilter === 'muted') {
            return base.filter(c => c.muted_until && new Date(c.muted_until).getTime() > Date.now());
        }

        return base;
    }, [chatScope, chats, favoriteSet, selectedList, selectedListSet, activeFilter]);

    const handleSyncAvatar = async () => {
        if (!selectedChat) return;
        setIsSyncingAvatar(true);
        try {
            const data = await whatsappService.syncAvatar(selectedChat.remote_jid, activeInstance?.instance || 'main');
            if (data.ok) {
                // Update local state for immediate feedback
                setSelectedChat((prev: any) => prev ? { ...prev, avatar_url: data.avatar_url } : null);
                updateChatAvatar(selectedChat.remote_jid, data.avatar_url);
                alert('Foto atualizada com sucesso!');
            } else {
                alert(data.error || 'Erro ao atualizar foto');
            }
        } catch (err: any) {
            alert('Erro de conexão ao atualizar foto');
        } finally {
            setIsSyncingAvatar(false);
        }
    };

    const selectedChatRef = useRef<Chat | null>(null);
    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);


    const loadHistory = useCallback(async (
        phone: string,
        instance?: string,
        remoteJid?: string,
        options?: { reset?: boolean; filters?: HistoryFilters },
        chatId?: string,
    ) => {
        const reset = options?.reset !== false;
        if (reset) setMsgLoading(true);
        else setHistoryLoadingMore(true);

        try {
            const cursorToUse = reset ? null : historyCursor;
            const beforeHeight = scrollRef.current?.scrollHeight || 0;
            const beforeTop = scrollRef.current?.scrollTop || 0;

            const data = await whatsappService.getHistory(
                phone,
                instance,
                remoteJid,
                chatId,
                cursorToUse,
            );

            // Backend now returns messages in chronological order (ASC)
            const batch = (data.messages || []).map(normalizeMessageRow);

            if (reset) {
                const map = new Map<string, Message>();
                batch.forEach(m => map.set(m.message_id, m));
                setMessages(Array.from(map.values()).sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                ));
            } else if (batch.length > 0) {
                prependingHistoryRef.current = true;
                setMessages((prev: Message[]) => {
                    const combined = [...batch, ...prev];
                    const map = new Map<string, Message>();
                    combined.forEach((m: Message) => map.set(m.message_id, m));
                    return Array.from(map.values()).sort((a: Message, b: Message) =>
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                });
                setTimeout(() => {
                    const el = scrollRef.current;
                    if (!el) return;
                    const afterHeight = el.scrollHeight;
                    el.scrollTop = afterHeight - beforeHeight + beforeTop;
                    prependingHistoryRef.current = false;
                }, 0);
            }

            setHistoryCursor(data.nextCursor || null);
            setHasMoreHistory(Boolean(data.hasMore));
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        } finally {
            setMsgLoading(false);
            setHistoryLoadingMore(false);
        }
    }, [historyCursor, historyFilters]);

    const loadChats = useCallback(async () => {
        setLoading(true);
        try {
            await fetchChatsStore();
        } finally {
            setLoading(false);
        }
    }, [fetchChatsStore]);

    const loadLabels = useCallback(async (instanceId?: string) => {
        try {
            const data = await whatsappService.getLabels(instanceId || activeInstanceRef.current?.instance || 'main');
            setAvailableLabels((data as any).labels || []);
        } catch (error) {
            console.error('Erro ao carregar labels:', error);
            setAvailableLabels([]);
        }
    }, []);

    const queueChatsRefresh = useCallback((delay = 700) => {
        if (chatsRefreshTimerRef.current) clearTimeout(chatsRefreshTimerRef.current);
        chatsRefreshTimerRef.current = setTimeout(() => {
            loadChats();
        }, delay);
    }, [loadChats]);

    const queueActiveHistoryRefresh = useCallback((delay = 420) => {
        if (historyRefreshTimerRef.current) clearTimeout(historyRefreshTimerRef.current);
        historyRefreshTimerRef.current = setTimeout(() => {
            const current = selectedChatRef.current;
            if (!current) return;
            loadHistory(current.phone, current.instance_name, current.remote_jid, { reset: true }, current.chat_id);
        }, delay);
    }, [loadHistory]);

    // After a new conversation is started, auto-select the chat once it appears in the list
    const handleNewConvoSent = useCallback((phone: string) => {
        pendingSelectPhoneRef.current = phone.replace(/\D/g, '');
        loadChats();
    }, [loadChats]);

    // When chats list updates, check if we need to auto-select a newly started chat
    useEffect(() => {
        if (!pendingSelectPhoneRef.current || chats.length === 0) return;
        const pendingDigits = pendingSelectPhoneRef.current;
        const found = chats.find((c) => {
            const cDigits = (c.phone || '').replace(/\D/g, '');
            return (
                cDigits === pendingDigits ||
                cDigits === pendingDigits.slice(2) ||
                ('55' + cDigits) === pendingDigits
            );
        });
        if (found) {
            pendingSelectPhoneRef.current = null;
            handleSelectChat(found);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chats]);

    const handleSocketEvent = useCallback((event: string, data: any) => {
        const eventInstance = data?.instance || data?.message?.instance;
        const currentInstance = activeInstanceRef.current?.instance;
        if (currentInstance && eventInstance && eventInstance !== currentInstance) {
            return;
        }

        switch (event) {
            case 'whatsapp:message': {
                const message = data?.message || {};
                const from = normalizeJid(data?.remote_jid || message?.key?.remoteJid || '');
                if (!from) return;

                if (message?.key && !message.key.fromMe && audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.log('[Audio] Play failed:', e));
                }

                const msgId = message?.key?.id || `evt_${Date.now()}`;
                const tsRaw = Number(message?.timestamp || message?.messageTimestamp || Math.floor(Date.now() / 1000));
                const tsIso = new Date(tsRaw * 1000).toISOString();
                const msgText = message?.text || message?.conversation || message?.extendedTextMessage?.text || '';
                const msgType = message?.type || Object.keys(message?.message || {})[0] || 'text';
                const quotedId = message?.quoted_message_id ||
                    message?.quoted_id ||
                    message?.message?.extendedTextMessage?.contextInfo?.stanzaId ||
                    message?.message?.imageMessage?.contextInfo?.stanzaId ||
                    message?.message?.videoMessage?.contextInfo?.stanzaId ||
                    message?.message?.documentMessage?.contextInfo?.stanzaId ||
                    null;
                const quotedText = message?.quoted_message_text ||
                    message?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
                    message?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
                    message?.message?.imageMessage?.contextInfo?.quotedMessage?.conversation ||
                    message?.message?.videoMessage?.contextInfo?.quotedMessage?.conversation ||
                    message?.message?.documentMessage?.contextInfo?.quotedMessage?.conversation ||
                    null;
                const quotedParticipant = message?.quoted_participant ||
                    message?.message?.extendedTextMessage?.contextInfo?.participant ||
                    message?.message?.imageMessage?.contextInfo?.participant ||
                    message?.message?.videoMessage?.contextInfo?.participant ||
                    message?.message?.documentMessage?.contextInfo?.participant ||
                    null;

                if (selectedChatRef.current && normalizeJid(selectedChatRef.current.remote_jid) === from) {
                    const newMsg: Message = {
                        id: Date.now(),
                        chat_id: selectedChatRef.current.id,
                        message_id: msgId,
                        text: msgText,
                        type: msgType === 'conversation' || msgType === 'extendedTextMessage' ? 'chat' : String(msgType).replace('Message', ''),
                        direction: message?.key?.fromMe ? 'out' : 'in',
                        status: message?.key?.fromMe ? 'sent' : 'pending',
                        timestamp: tsIso,
                        quoted_id: quotedId,
                        quoted_message_id: quotedId,
                        quoted_message_text: quotedText,
                        quoted_participant: quotedParticipant,
                        reactions: {},
                        message_payload: message?.message || message,
                        participant: message?.key?.participant || null,
                    };
                    setMessages((prev: any) => {
                        if (prev.some((m: any) => m.message_id === newMsg.message_id)) return prev;
                        return [...prev, newMsg];
                    });
                }

                const mediaSnippet = (() => {
                    const t = String(msgType || '').toLowerCase().replace('message', '');
                    if (t === 'image') return '📷 Imagem';
                    if (t === 'video') return '🎬 Vídeo';
                    if (t === 'audio' || t === 'ptt') return '🎤 Áudio';
                    if (t === 'document') return '📄 Documento';
                    if (t === 'sticker') return '🖼️ Figurinha';
                    return 'Mídia';
                })();
                const found = upsertMessageEvent({
                    remoteJid: data?.remote_jid || message?.key?.remoteJid || '',
                    text: msgText || mediaSnippet,
                    timestampIso: tsIso,
                    fromMe: Boolean(message?.key?.fromMe),
                    status: message?.key?.fromMe ? 'sent' : 'delivered',
                    messageId: msgId,
                    messagePayload: message?.message || message,
                    pushName: message?.pushName || data?.pushName,
                    instanceName: eventInstance || activeInstanceRef.current?.instance,
                });
                if (!found) {
                    queueChatsRefresh(900);
                }
                setSelectedChat((prev: any) => {
                    if (!prev) return prev;
                    if (normalizeJid(prev.remote_jid) !== from) return prev;
                    return {
                        ...prev,
                        last_message_text: msgText || prev.last_message_text,
                        last_message_time: tsIso,
                        last_message_from_me: message?.key?.fromMe ? 1 : 0,
                        unread_count: 0,
                        last_message_payload: message?.message || message,
                    };
                });
                break;
            }

            case 'whatsapp:status': {
                const { message_id, status, remote_jid } = data;
                setMessages((prev: any) => prev.map((m: any) => m.message_id === message_id ? { ...m, status } : m));
                if (remote_jid && status) {
                    updateChatLastStatus(remote_jid, status);
                } else {
                    queueChatsRefresh(700);
                }
                break;
            }

            case 'whatsapp:reaction': {
                const { message_id, reactions, remote_jid, reaction_text, timestamp, from_me } = data || {};
                if (!message_id) break;
                setMessages((prev: any) =>
                    prev.map((m: any) =>
                        m.message_id === message_id
                            ? { ...m, reactions: (reactions && typeof reactions === 'object') ? reactions : (m.reactions || {}) }
                            : m
                    )
                );
                if (remote_jid && reaction_text) {
                    const tsIso = timestamp ? new Date(Number(timestamp)).toISOString() : new Date().toISOString();
                    updateChatLastReaction(remote_jid, reaction_text, tsIso, Boolean(from_me));
                } else {
                    queueChatsRefresh(900);
                }
                break;
            }

            case 'whatsapp:connection_update':
                refreshInstances();
                break;

            case 'whatsapp:session_connected':
                refreshInstances();
                if (!currentInstance || currentInstance === data.instance) {
                    queueChatsRefresh(350);
                }
                break;

            case 'whatsapp:message_persisted':
                if (!currentInstance || !eventInstance || currentInstance === eventInstance) {
                    if (selectedChatRef.current && normalizeJid(selectedChatRef.current.remote_jid) === normalizeJid(data?.remote_jid || '')) {
                        queueActiveHistoryRefresh(350);
                    } else {
                        queueChatsRefresh(1000);
                    }
                }
                break;

            case 'whatsapp:presence':
                if (data?.remote_jid && data?.presence) {
                    upsertPresence(data.remote_jid, data.presence);
                }
                break;

            case 'whatsapp:group_update': {
                const { remote_jid, subject } = data || {};
                if (remote_jid && subject) {
                    updateGroupSubject(remote_jid, subject);
                    if (selectedChatRef.current && normalizeJid(selectedChatRef.current.remote_jid) === normalizeJid(remote_jid)) {
                        setSelectedChat((prev: any) => prev ? { ...prev, subject } : prev);
                    }
                }
                break;
            }

            default:
                break;
        }
    }, [queueActiveHistoryRefresh, queueChatsRefresh, updateChatLastReaction, updateChatLastStatus, upsertMessageEvent, upsertPresence, refreshInstances]);

    // Keep refs in sync so Socket.IO listeners always call the latest version
    handleSocketEventRef.current = handleSocketEvent;
    queueChatsRefreshRef.current = queueChatsRefresh;

    const syncEvents = useCallback(async (after: number) => {
        const BASE_DELAY = 1500;
        const MAX_DELAY = 12000;
        try {
            const data = await whatsappService.syncEvents(after);
            if (data.ok) {
                if (data.events?.length > 0) {
                    data.events.forEach((evt: any) => {
                        handleSocketEvent(evt.event, evt.data);
                    });
                }
                syncFailureStreakRef.current = 0;
                syncPollDelayMsRef.current = BASE_DELAY;
                return typeof (data as any).timestamp === 'number' ? (data as any).timestamp : after;
            }
            syncFailureStreakRef.current += 1;
            const pow = Math.min(3, syncFailureStreakRef.current);
            syncPollDelayMsRef.current = Math.min(MAX_DELAY, BASE_DELAY * (2 ** pow));
        } catch (error) {
            syncFailureStreakRef.current += 1;
            const pow = Math.min(3, syncFailureStreakRef.current);
            syncPollDelayMsRef.current = Math.min(MAX_DELAY, BASE_DELAY * (2 ** pow));
            const now = Date.now();
            if (now - lastSyncErrorLogAtRef.current > 30000) {
                const msg = error instanceof Error ? error.message : 'erro_transitorio';
                console.warn(`[Sync] transient failure: ${msg}`);
                lastSyncErrorLogAtRef.current = now;
            }
        }
        return after;
    }, [handleSocketEvent]);


    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const handleResize = () => setIsMobile(window.innerWidth < 768);
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsInstanceDropdownOpen(false);
            }
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setIsOptionsMenuOpen(false);
            }
            if (chatOptionsRef.current && !chatOptionsRef.current.contains(event.target as Node)) {
                setIsChatMenuOpen(false);
            }
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setIsFilterMenuOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        document.addEventListener('mousedown', handleClickOutside);
        handleResize();

        // Initialize Store Data
        startInstancePolling(10000);
        
        // Initial instances check
        refreshInstances().then(() => {
            const queryInst = new URLSearchParams(window.location.search).get('instance');
            const state = getState();
            const insts = state.instances || [];
            
            if (insts.length === 0) {
                // If after refresh still no instances, redirect
                // router.push('/admin/whatsapp/sessions');
            } else if (!activeInstance) {
                const initial = insts.find((i: WhatsAppInstance) => i.instance === queryInst) || insts[0];
                setActiveInstance(initial);
            }
        });

        audioRef.current = new Audio('/sounds/notify.mp3');

        import("../../core/chatEngine").then(({ chatEngine }) => {
            chatEngine.connect(user?.uid);
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('mousedown', handleClickOutside);
            stopInstancePolling();
        };
    }, []);

    useEffect(() => {
        if (activeInstance?.instance) {
            // Ignore stale backlog; initial page load already got state from /chats and /history.
            syncCursorRef.current = Date.now();
        }
    }, [activeInstance?.instance]);

    // Passo 1.5 - Auto-seleção de Instância Conectada
    useEffect(() => {
        if (!activeInstance && instances.length > 0) {
            const connected = instances.find(i => ['connected', 'open', 'authenticated'].includes(i.status || ''));
            if (connected) {
                setActiveInstance(connected);
            }
        }
    }, [activeInstance, instances, setActiveInstance]);

    // Passo 1.5 - Disparar fetchChats sempre que a instância mudar
    useEffect(() => {
        if (activeInstance?.instance) {
            fetchChatsStore();
        }
    }, [activeInstance, fetchChatsStore]);

    const runSyncLoop = useCallback(async () => {
        if (!activeInstanceRef.current?.instance) {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(runSyncLoop, 2000);
            return;
        }
        if (syncInFlightRef.current) {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(runSyncLoop, syncPollDelayMsRef.current);
            return;
        }
        syncInFlightRef.current = true;
        try {
            syncCursorRef.current = await syncEvents(syncCursorRef.current);
        } finally {
            syncInFlightRef.current = false;
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(runSyncLoop, syncPollDelayMsRef.current);
        }
    }, [syncEvents]);

    useEffect(() => {
        syncPollDelayMsRef.current = 1500;
        syncFailureStreakRef.current = 0;
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(runSyncLoop, 800);
        return () => {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        };
    }, [runSyncLoop]);

    useEffect(() => {
        return () => {
            if (chatsRefreshTimerRef.current) clearTimeout(chatsRefreshTimerRef.current);
            if (historyRefreshTimerRef.current) clearTimeout(historyRefreshTimerRef.current);
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        };
    }, []);

    // ─── Socket.IO real-time connection ───────────────────────────────────────
    useEffect(() => {
        const uid = user?.uid;
        if (!uid) return;

        const socket = socketIO(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8001', {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
            socket.emit('user_connected', { userId: uid });
        });

        // New message from Baileys
        socket.on('push_new_msg', (data: any) => {
            const msg = data?.msg;
            if (!msg) return;
            const isOutgoing = msg.route === 'outgoing';
            handleSocketEventRef.current?.('whatsapp:message', {
                instance: data.sessionId,
                remote_jid: msg.remoteJid,
                message: {
                    key: { id: msg.msgId, fromMe: isOutgoing, remoteJid: msg.remoteJid },
                    timestamp: msg.timestamp,
                    pushName: msg.senderName,
                    text: msg.msgContext?.text || '',
                    conversation: msg.msgContext?.text || '',
                    type: msg.type,
                    message: msg.msgContext || {},
                },
            });
        });

        // Delivery/read receipt update
        socket.on('update_delivery_status', (data: any) => {
            try {
                const decoded = JSON.parse(atob(data.chatId));
                const remoteJid = decoded.grp
                    ? `${decoded.num}@g.us`
                    : `${decoded.num}@s.whatsapp.net`;
                handleSocketEventRef.current?.('whatsapp:status', {
                    message_id: data.msgId,
                    status: data.status,
                    remote_jid: remoteJid,
                });
            } catch { /* ignore malformed chatId */ }
        });

        // Chats list updated — just refresh
        socket.on('update_conversations', () => {
            queueChatsRefreshRef.current?.(400);
        });

        // Reaction received
        socket.on('push_new_reaction', (data: any) => {
            try {
                const decoded = JSON.parse(atob(data.chatId));
                const remoteJid = decoded.grp
                    ? `${decoded.num}@g.us`
                    : `${decoded.num}@s.whatsapp.net`;
                handleSocketEventRef.current?.('whatsapp:reaction', {
                    message_id: data.msgId,
                    reaction_text: data.reaction,
                    remote_jid: remoteJid,
                    from_me: false,
                    timestamp: Date.now(),
                });
            } catch { /* ignore malformed chatId */ }
        });

        return () => {
            socket.disconnect();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]);

    useEffect(() => {
        if (!activeInstance?.instance) {
            clearChats();
            setMessages([]);
            setAvailableLabels([]);
            setLoading(false);
            initialized.current = false;
            return;
        }

        // Avoid infinite loop by only triggering if instance truly changed or not yet initialized
        if (initialized.current === activeInstance.instance) return;
        initialized.current = activeInstance.instance;

        setLoading(true);
        setSelectedChat(null);
        setMessages([]);
        loadChats();
        loadLabels(activeInstance.instance);
    }, [activeInstance?.instance, clearChats, loadChats, loadLabels]);

    useEffect(() => {
        if (!selectedChat?.remote_jid) return;
        setHistoryCursor(null);
        setHasMoreHistory(false);
        setHistoryFilters({});
        loadHistory(selectedChat.phone, selectedChat.instance_name, selectedChat.remote_jid, { reset: true, filters: {} }, selectedChat.chat_id);
        // only reset/reload when switching conversation, not when sidebar metadata updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChat?.remote_jid]);

    useEffect(() => {
        if (!selectedChat) return;
        const refreshed = chats.find(c => normalizeJid(c.remote_jid) === normalizeJid(selectedChat.remote_jid));
        if (!refreshed) return;
        const changed =
            refreshed.last_message_time !== selectedChat.last_message_time ||
            refreshed.last_message_text !== selectedChat.last_message_text ||
            refreshed.avatar_url !== selectedChat.avatar_url ||
            refreshed.subject !== selectedChat.subject;
        if (changed) setSelectedChat((prev: any) => (prev ? { ...refreshed, unread_count: 0 } : prev));
    }, [chats, selectedChat?.remote_jid, selectedChat?.last_message_time, selectedChat?.last_message_text, selectedChat?.avatar_url, selectedChat?.subject]);

    useEffect(() => {
        if (prependingHistoryRef.current) return;
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);


    const handleTyping = () => {
        if (!selectedChat) return;
        // Use remote_jid (full JID) so groups (@g.us) get the correct presence recipient
        const presenceTo = selectedChat.remote_jid || selectedChat.phone;

        if (!isTypingRef.current) {
            isTypingRef.current = true;
            setIsTyping(true);
            whatsappService.sendPresence(
                presenceTo,
                'composing',
                activeInstance?.instance || selectedChat.instance_name
            ).catch(() => { });
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            setIsTyping(false);
            whatsappService.sendPresence(
                presenceTo,
                'available',
                activeInstance?.instance || selectedChat.instance_name
            ).catch(() => { });
        }, 3000);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!selectedChat || !newMessage.trim()) return;

        const text = newMessage;
        const currentChat = selectedChat;
        const quotedId = replyingTo?.message_id || null;
        const quotedRemoteJid = currentChat.remote_jid;
        const quotedParticipant =
            replyingTo?.participant ||
            replyingTo?.message_payload?.key?.participant ||
            undefined;
        const quotedFromMe =
            replyingTo?.direction === 'out' ||
            Boolean(replyingTo?.message_payload?.key?.fromMe);
        const quotedPayload = quotedId ? {
            key: {
                id: quotedId,
                remoteJid: quotedRemoteJid,
                fromMe: quotedFromMe,
                ...(quotedParticipant ? { participant: quotedParticipant } : {}),
            },
            message: (
                replyingTo?.message_payload &&
                typeof replyingTo.message_payload === 'object' &&
                Object.keys(replyingTo.message_payload).length > 0
            )
                ? replyingTo.message_payload
                : { conversation: replyingTo?.text || '' },
        } : undefined;
        setNewMessage('');
        const jid = normalizeJid(currentChat.remote_jid);
        setDrafts(prev => {
            const next = { ...prev };
            delete next[jid];
            return next;
        });
        setIsTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // 1. Optimistic Update (Immediate Feedback)
        const tempId = `temp_${Date.now()}`;
        const tempMsg: Message = {
            id: Date.now(),
            chat_id: currentChat.id,
            message_id: tempId,
            text,
            type: 'text',
            direction: 'out',
            status: 'pending',
            timestamp: new Date().toISOString(),
            quoted_id: quotedId,
            quoted_message_id: quotedId,
            quoted_message_text: replyingTo?.text || null,
            quoted_participant: quotedParticipant || null,
        };

        setMessages((prev: any) => [...prev, tempMsg]);

        upsertMessageEvent({
            remoteJid: currentChat.remote_jid,
            text,
            timestampIso: new Date().toISOString(),
            fromMe: true,
            status: 'pending',
            messagePayload: { conversation: text },
        });

        try {
            // 3. Fire real-time request (Backend responds as soon as robot fires)
            const result = await whatsappService.sendText(
                currentChat.instance_name,
                currentChat.remote_jid,
                text,
                undefined,
                quotedId || undefined,
                currentChat.remote_jid || undefined,
                quotedPayload,
                currentChat.chat_id || undefined,
                currentChat.displayName || undefined,
            );

            // Update status once backend confirms robot fired
            setMessages((prev: any) => {
                const realId = result.messageId;
                const alreadyHasReal = realId && prev.some((m: Message) => m.message_id === realId);
                if (alreadyHasReal) return prev.filter((m: Message) => m.message_id !== tempId);
                return prev.map((m: Message) => m.message_id === tempId ? {
                    ...m,
                    message_id: realId || m.message_id,
                    status: 'sent'
                } : m);
            });
            updateChatLastStatus(currentChat.remote_jid, 'sent');
            setReplyingTo(null);

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            setMessages((prev: any) => prev.filter((m: any) => m.message_id !== tempId));
            // Trigger a quick reload to fix state
            queueChatsRefresh(1000);
        }
    };

    const handleSendMedia = async (file: File) => {
        if (!selectedChat) return;
        const currentChat = selectedChat;
        try {
            // 1. Upload file
            const uploadRes = await whatsappService.uploadFile(file);
            if (!uploadRes.url) throw new Error('Upload falhou');

            // 2. Optimistic update
            const tempId = `temp_media_${Date.now()}`;
            const tempMsg: Message = {
                id: Date.now(),
                chat_id: currentChat.id,
                message_id: tempId,
                text: file.name,
                type: file.type.startsWith('image') ? 'image' : (file.type.startsWith('video') ? 'video' : 'document'),
                direction: 'out',
                status: 'pending',
                timestamp: new Date().toISOString(),
                media_url: uploadRes.url,
                media_type: file.type,
                media_size: file.size,
            };
            setMessages((prev: any) => [...prev, tempMsg]);

            // 3. Send via plugin
            const result = await whatsappService.sendMedia(
                currentChat.instance_name,
                currentChat.remote_jid,
                uploadRes.url,
                file.type,
                undefined,
                undefined
            );

            // 4. Update status
            setMessages((prev: any) => {
                const realId = result.messageId;
                const alreadyHasReal = realId && prev.some((m: Message) => m.message_id === realId);
                if (alreadyHasReal) return prev.filter((m: Message) => m.message_id !== tempId);
                return prev.map((m: Message) => m.message_id === tempId ? {
                    ...m,
                    message_id: realId || m.message_id,
                    status: 'sent'
                } : m);
            });
        } catch (err) {
            console.error('Erro ao enviar mídia:', err);
            alert('Falha ao enviar arquivo.');
        }
    };

    const handleSendAudio = async (blob: Blob) => {
        if (!selectedChat) return;
        const currentChat = selectedChat;
        try {
            // 1. Upload blob as file
            const file = new File([blob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' });
            const uploadRes = await whatsappService.uploadFile(file);
            if (!uploadRes.url) throw new Error('Upload falhou');

            // 2. Optimistic update
            const tempId = `temp_audio_${Date.now()}`;
            const tempMsg: Message = {
                id: Date.now(),
                chat_id: currentChat.id,
                message_id: tempId,
                text: '',
                type: 'audio',
                direction: 'out',
                status: 'pending',
                timestamp: new Date().toISOString(),
                media_url: uploadRes.url,
                media_type: 'audio/ogg',
            };
            setMessages((prev: any) => [...prev, tempMsg]);

            // 3. Send via plugin
            const result = await whatsappService.sendAudio(
                currentChat.instance_name,
                currentChat.remote_jid,
                uploadRes.url
            );

            // 4. Update status
            setMessages((prev: any) => {
                const realId = result.messageId;
                const alreadyHasReal = realId && prev.some((m: Message) => m.message_id === realId);
                if (alreadyHasReal) return prev.filter((m: Message) => m.message_id !== tempId);
                return prev.map((m: Message) => m.message_id === tempId ? {
                    ...m,
                    message_id: realId || m.message_id,
                    status: 'sent'
                } : m);
            });
        } catch (err) {
            console.error('Erro ao enviar áudio:', err);
        }
    };

    const handleReactToMessage = useCallback(async (msg: Message, emoji: string) => {
        if (!selectedChat) return;
        const messageId = msg.message_id;
        const previous = messages.find((m: any) => m.message_id === messageId)?.reactions || null;
        const currentMine = previous?.me || '';
        const nextEmoji = currentMine === emoji ? '' : emoji;
        setMessages((prev: Message[]) => prev.map((m: any) => {
            if (m.message_id !== messageId) return m;
            const next = { ...(m.reactions || {}) } as Record<string, string>;
            if (!nextEmoji) delete next.me;
            else next.me = nextEmoji;
            return { ...m, reactions: next };
        }));
        setReactionPickerFor(null);
        try {
            await whatsappService.reactMessage(selectedChat.instance_name, selectedChat.remote_jid, messageId, nextEmoji);
        } catch (err) {
            console.error('Erro ao reagir:', err);
            setMessages((prev: Message[]) => prev.map((m: any) => (
                m.message_id === messageId ? { ...m, reactions: previous } : m
            )));
        }
    }, [messages, selectedChat]);

    const handleDeleteMessage = useCallback(async (msg: Message) => {
        if (!selectedChat || !window.confirm('Apagar esta mensagem para todos?')) return;
        try {
            await whatsappService.deleteMessage(selectedChat.instance_name, selectedChat.remote_jid, msg.message_id);
            setMessages((prev: any) => prev.map((m: any) => m.message_id === msg.message_id ? { ...m, status: 'deleted', text: '🚫 Mensagem apagada' } : m));
        } catch (err: any) {
            alert('Erro ao apagar: ' + err.message);
        }
    }, [selectedChat]);

    const handleEditMessage = useCallback(async (msg: Message) => {
        if (!selectedChat || msg.type !== 'text') return;
        const newText = window.prompt('Editar mensagem:', msg.text || '');
        if (newText === null || newText === msg.text || !newText.trim()) return;
        
        try {
            await whatsappService.editMessage(selectedChat.instance_name, selectedChat.remote_jid, msg.message_id, newText.trim());
            setMessages((prev: any) => prev.map((m: any) => m.message_id === msg.message_id ? { ...m, text: newText.trim() } : m));
        } catch (err: any) {
            alert('Erro ao editar: ' + err.message);
        }
    }, [selectedChat]);

    const handleForwardMessage = useCallback((msg: Message) => {
        setMessageToForward(msg);
        setIsForwardModalOpen(true);
    }, []);

    const executeForward = async (targetChats: Chat[]) => {
        if (!messageToForward || targetChats.length === 0) return;
        setIsForwardModalOpen(false);
        const payload = messageToForward.message_payload || { text: messageToForward.text };

        for (const chat of targetChats) {
            try {
                await whatsappService.forwardMessage(chat.instance_name, chat.remote_jid, payload);
            } catch (err) {
                console.error('Erro ao encaminhar para', chat.remote_jid, err);
            }
        }
        setMessageToForward(null);
        alert('Mensagens encaminhadas!');
    };

    const handleSyncGroup = useCallback(async () => {
        if (!selectedChat || !selectedChat.remote_jid.endsWith('@g.us')) return;
        try {
            setMsgLoading(true);
            await whatsappService.syncGroupMetadata(selectedChat.remote_jid, selectedChat.instance_name);
            queueChatsRefresh(500);
            alert('Metadados do grupo atualizados!');
        } catch (err) {
            console.error('Erro ao sincronizar grupo:', err);
        } finally {
            setMsgLoading(false);
        }
    }, [selectedChat, queueChatsRefresh]);

    const handleSelectChat = useCallback((chat: Chat) => {
        // Save current draft if any
        if (selectedChat) {
            const currentJid = normalizeJid(selectedChat.remote_jid);
            if (newMessage.trim()) {
                setDrafts(prev => ({ ...prev, [currentJid]: newMessage }));
            } else {
                setDrafts(prev => {
                    const next = { ...prev };
                    delete next[currentJid];
                    return next;
                });
            }
        }

        const nextJid = normalizeJid(chat.remote_jid);
        setSelectedChat({ ...chat, unread_count: 0 });
        setNewMessage(drafts[nextJid] || '');
        setReplyingTo(null);
        setReactionPickerFor(null);
        void handleChatSelectStore(chat);
    }, [selectedChat, newMessage, drafts, handleChatSelectStore]);

    const handleChatMenuAction = useCallback(async (
        action: 'archive' | 'mute' | 'pin' | 'mark_read' | 'block' | 'delete' | 'favorite' | 'list_add' | 'list_remove' | 'sync_group',
        chat: Chat
    ) => {
        try {
            const jidKey = normalizeJid(chat.remote_jid) || chat.remote_jid;

            if (action === 'favorite') {
                setFavoriteJids((prev) => (
                    prev.includes(jidKey) ? prev.filter((jid) => jid !== jidKey) : [jidKey, ...prev]
                ));
                return;
            }

            if (action === 'list_add') {
                const typed = window.prompt('Nome da lista personalizada:', selectedList?.name || '');
                const listName = (typed || '').trim();
                if (!listName) return;
                let targetListId: string | null = null;
                setCustomLists((prev) => {
                    const existing = prev.find((l) => l.name.toLowerCase() === listName.toLowerCase());
                    if (existing) {
                        targetListId = existing.id;
                        if (existing.jids.includes(jidKey)) return prev;
                        return prev.map((l) => l.id === existing.id ? { ...l, jids: [jidKey, ...l.jids] } : l);
                    }
                    const id = `list_${Date.now()}`;
                    targetListId = id;
                    return [{ id, name: listName, jids: [jidKey] }, ...prev];
                });
                if (targetListId) setActiveCustomListId(targetListId);
                if (chatScope !== 'custom_list') setChatScope('custom_list');
                return;
            }

            if (action === 'list_remove') {
                setCustomLists((prev) => prev.map((l) => (
                    l.id === activeCustomListId
                        ? { ...l, jids: l.jids.filter((jid) => jid !== jidKey) }
                        : l
                )));
                return;
            }

            if (action === 'mark_read') {
                await whatsappService.markAsRead(chat.remote_jid, chat.instance_name);
                patchChatById(chat.id, { unread_count: 0 });
                if (selectedChat?.id === chat.id) setSelectedChat((prev: any) => (prev ? { ...prev, unread_count: 0 } : prev));
                return;
            }

            if (action === 'pin') {
                const nextPinned = !Boolean(chat.is_pinned);
                await whatsappService.pinChat(chat.id, nextPinned);
                patchChatById(chat.id, { is_pinned: nextPinned ? 1 : 0 });
                if (selectedChat?.id === chat.id) setSelectedChat((prev: any) => (prev ? { ...prev, is_pinned: nextPinned ? 1 : 0 } : prev));
                return;
            }

            if (action === 'sync_group') {
                await syncGroupMetadata(chat.remote_jid, chat.instance_name);
                return;
            }

            if (action === 'mute') {
                const currentlyMuted = Boolean(chat.muted_until && new Date(chat.muted_until).getTime() > Date.now());
                const nextMuted = !currentlyMuted;
                const until = nextMuted ? new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString() : undefined;
                await whatsappService.muteChat(chat.id, nextMuted, until);
                patchChatById(chat.id, { muted_until: nextMuted ? until || null : null });
                if (selectedChat?.id === chat.id) setSelectedChat((prev: any) => (prev ? { ...prev, muted_until: nextMuted ? until || null : null } : prev));
                return;
            }

            if (action === 'archive') {
                const nextArchived = !Boolean(chat.is_archived);
                await whatsappService.archiveChat(chat.id, nextArchived);
                patchChatById(chat.id, { is_archived: nextArchived ? 1 : 0 });
                if (selectedChat?.id === chat.id && nextArchived && chatScope !== 'archived') {
                    setSelectedChat(null);
                    setMessages([]);
                }
                return;
            }

            if (action === 'delete') {
                await whatsappService.deleteChat(chat.id);
                removeChatById(chat.id);
                setFavoriteJids((prev) => prev.filter((jid) => jid !== jidKey));
                setCustomLists((prev) => prev.map((l) => ({ ...l, jids: l.jids.filter((jid) => jid !== jidKey) })));
                if (selectedChat?.id === chat.id) {
                    setSelectedChat(null);
                    setMessages([]);
                }
                return;
            }

            if (action === 'block') {
                const isBlocked = chat.last_message_text === '🚫 Contato Bloqueado';
                const confirmMsg = isBlocked 
                    ? `Deseja DESBLOQUEAR o contato ${chat.subject || chat.phone}?`
                    : `Deseja BLOQUEAR o contato ${chat.subject || chat.phone}?`;
                
                if (!window.confirm(confirmMsg)) return;
                
                await whatsappService.blockContact(chat.instance_name, chat.remote_jid, !isBlocked);
                alert(isBlocked ? 'Contato desbloqueado!' : 'Contato bloqueado!');
                return;
            }
        } catch (error: any) {
            console.error(`[Inbox] chat action failed: ${action}`, error);
            alert(error?.message || 'Não foi possível concluir a ação.');
        }
    }, [activeCustomListId, chatScope, patchChatById, removeChatById, selectedChat?.id, selectedList?.name]);

    // All message rendering logic and utilities have been moved to components and ./utils.ts

    return (<div className="flex-1 flex flex-col h-full bg-gray-100 overflow-hidden text-gray-700">
            <div className="flex flex-1 overflow-hidden h-full">

                {/* Left Thin Sidebar */}
                <ThinSidebar
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    activeInstance={activeInstance}
                />

                {/* Sidebar - Chat List */}
                {activeTab === 'chats' && (
                    <div className={`${isMobile ? (selectedChat ? 'hidden' : 'w-full') : 'w-[380px]'} flex flex-col border-r border-gray-200 bg-white h-full relative z-20`}>
                    {/* Sidebar Header - Matches Img 1 & 3 */}
                    <div className="bg-gray-50 z-20 border-b border-gray-200">
                        {/* Top Row: User Info & Actions - Matches Img 3 */}
                        <div className="h-[65px] px-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/admin/dashboard"
                                    className="p-2 hover:bg-black/5 rounded-full transition-colors text-gray-500"
                                    title="Voltar"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>

                                <div className="relative group/dropdown" ref={dropdownRef}>
                                    <div
                                        onClick={() => setIsInstanceDropdownOpen(!isInstanceDropdownOpen)}
                                        className="profile-dropdown flex items-center gap-3 cursor-pointer group p-1 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border-2 shadow-sm transition-transform active:scale-95 ${['connected', 'open', 'authenticated'].includes(activeInstance?.status || '') ? 'bg-emerald-500 border-emerald-600' : 'bg-gray-300 border-gray-400'}`}>
                                            {(activeInstance?.avatar || activeInstance?.profilePictureUrl) && !instanceAvatarErrors[activeInstance?.instance || ''] ? (
                                                <img
                                                    src={activeInstance.avatar || activeInstance.profilePictureUrl || ''}
                                                    alt="Avatar"
                                                    className="w-full h-full object-cover"
                                                    onError={() => setInstanceAvatarErrors(prev => ({ ...prev, [activeInstance?.instance || '']: true }))}
                                                />
                                            ) : (
                                                <span className="text-white font-bold text-sm select-none">
                                                    {activeInstance?.nome ? activeInstance.nome.charAt(0).toUpperCase() : (activeInstance?.phone || '?').slice(-4)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-gray-900 truncate">
                                                {activeInstance?.nome || 'Instância'}
                                            </span>
                                            <span className={`text-[11px] truncate font-medium ${['connected', 'open', 'authenticated'].includes(activeInstance?.status || '') ? 'text-emerald-600' : 'text-gray-500'}`}>
                                                {['connected', 'open', 'authenticated'].includes(activeInstance?.status || '') 
                                                    ? (activeInstance?.phone ? `+${activeInstance.phone}` : 'Conectado (Sem número)') 
                                                    : 'Não conectado'}
                                            </span>
                                        </div>
                                        <button className={`p-1 hover:bg-gray-100 rounded-full transition-all ${isInstanceDropdownOpen ? 'rotate-180' : ''}`}>
                                            <ChevronDown className="w-5 h-5 text-gray-500" />
                                        </button>
                                    </div>

                                    {/* Dropdown Menu - Matches Dropdown in Img 3 */}
                                    <AnimatePresence>
                                        {isInstanceDropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                className="absolute left-0 top-[calc(100%+8px)] w-80 bg-white rounded-xl shadow-2xl border border-gray-100 py-4 z-50 overflow-hidden"
                                            >
                                                <div className="px-5 pb-4 text-[16px] font-bold text-[#111b21]">
                                                    Selecionar Instância
                                                </div>
                                                <div className="border-t border-gray-50 my-1"></div>
                                                <div className="max-h-[340px] overflow-y-auto px-2 space-y-1 custom-scrollbar">
                                                    {instances.map((inst) => (
                                                        <button
                                                            key={inst.instance}
                                                            onClick={() => {
                                                                setActiveInstance(inst);
                                                                setIsInstanceDropdownOpen(false);
                                                            }}
                                                            className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors group/item ${activeInstance?.instance === inst.instance ? 'bg-gray-50' : ''}`}
                                                        >
                                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 flex-shrink-0 ${['connected', 'open', 'authenticated'].includes(inst.status || '') ? 'bg-emerald-500 border-emerald-600' : 'bg-gray-300 border-gray-400'}`}>
                                                                {(inst.avatar || inst.profilePictureUrl) && !instanceAvatarErrors[inst.instance] ? (
                                                                    <img
                                                                        src={inst.avatar || inst.profilePictureUrl || ''}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                        onError={() => setInstanceAvatarErrors(prev => ({ ...prev, [inst.instance]: true }))}
                                                                    />
                                                                ) : (
                                                                    <span className="text-white font-bold text-base select-none">
                                                                        {inst.nome ? inst.nome.charAt(0).toUpperCase() : (inst.phone || '?').slice(-4)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 flex flex-col text-left overflow-hidden min-w-0">
                                                                <span className="text-[15px] font-bold text-[#111b21] truncate">{inst.nome}</span>
                                                                <span className="text-[13px] text-gray-500 truncate">{inst.phone}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 pr-2 flex-shrink-0">
                                                                <span className={`px-3 py-1 rounded-full text-[12px] font-bold ring-1 ring-inset ${['connected', 'open', 'authenticated'].includes(inst.status || '') ? 'bg-green-50 text-[#00a884] ring-green-600/10' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                                                                    {['connected', 'open', 'authenticated'].includes(inst.status || '') ? 'Ativa' : 'Desconectada'}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => loadChats()}
                                    className="header-menu p-2 hover:bg-black/5 rounded-full transition-colors"
                                    title="Atualizar"
                                >
                                    <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={() => setIsNewConvoModalOpen(true)}
                                    className="header-menu p-2 hover:bg-black/5 rounded-full transition-colors"
                                    title="Nova conversa"
                                >
                                    <MessageSquarePlus className="w-5 h-5 text-gray-500" />
                                </button>
                                <div className="relative" ref={optionsRef}>
                                    <button
                                        onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                                        className="header-menu p-2 hover:bg-black/5 rounded-full transition-colors"
                                    >
                                        <MoreVertical className="w-5 h-5 text-gray-500" />
                                    </button>

                                    <AnimatePresence>
                                        {isOptionsMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 overflow-hidden"
                                            >
                                                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-100 transition-colors">
                                                    <Settings className="w-4 h-4" />
                                                    Configurações
                                                </button>
                                                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-100 transition-colors">
                                                    <HelpCircle className="w-4 h-4" />
                                                    Suporte
                                                </button>
                                                <div className="border-t border-gray-100 my-1" />
                                                <button 
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                    onClick={async () => {
                                                        setIsOptionsMenuOpen(false);
                                                        if (!confirm('⚠️ Tem certeza? Isso vai apagar TODOS os chats, mensagens e mídias recebidas.')) return;
                                                        if (!confirm('🚨 ÚLTIMA CHANCE! Esta ação é irreversível. Confirmar?')) return;
                                                        try {
                                                            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                                                            const res = await fetch('/api/inbox/purge_all_data', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                                            });
                                                            const data = await res.json();
                                                            if (data.success) {
                                                                clearChats();
                                                                useChatStore.getState().clearAll?.();
                                                                alert('✅ Tudo limpo! Chats, mensagens e mídias apagados.');
                                                            } else {
                                                                alert('Erro: ' + (data.msg || 'Falha na limpeza'));
                                                            }
                                                        } catch (err: any) {
                                                            alert('Erro: ' + err.message);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Limpar Tudo
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {/* Search & Filters Refined - Matches Img 1 & 2 */}
                        <div className="px-3 pb-2 flex items-center gap-2">
                             <div className="relative flex-1 group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Pesquise ou comece uma nova conversa"
                                    className="w-full bg-gray-100 h-[35px] pl-10 pr-4 py-1.5 rounded-full text-sm border-none focus:ring-0 text-gray-700 placeholder-gray-400 shadow-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="relative" ref={filterMenuRef}>
                                <button
                                    onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${isFilterMenuOpen ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                >
                                    <Filter className="w-4 h-4" />
                                </button>

                                {/* Filter Dropdown - Matches Img 2 */}
                                <AnimatePresence>
                                    {isFilterMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                            className="absolute left-0 top-full mt-2 w-56 bg-white rounded-lg shadow-2xl border border-gray-100 py-1.5 z-50 overflow-hidden"
                                        >
                                            {[
                                                { id: 'all', label: 'Tudo', count: filterCounts.all },
                                                { id: 'unread', label: 'Não lidas', count: filterCounts.unread },
                                                { id: 'groups', label: 'Grupos', count: filterCounts.groups },
                                                { id: 'pinned', label: 'Fixadas', count: filterCounts.pinned },
                                                { id: 'muted', label: 'Silenciadas', count: filterCounts.muted },
                                                { id: 'marked', label: 'Marcadas', count: filterCounts.marked },
                                                { id: 'archived', label: 'Arquivadas', count: filterCounts.archived },
                                            ].map((filter) => (
                                                <button
                                                    key={filter.id}
                                                    onClick={() => {
                                                        setActiveFilter(filter.id);
                                                        setIsFilterMenuOpen(false);
                                                        if (filter.id === 'archived') setChatScope('archived');
                                                        else setChatScope('inbox');
                                                    }}
                                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-[14px] transition-colors ${activeFilter === filter.id ? 'bg-gray-100 font-bold text-gray-900' : 'text-gray-700 hover:bg-[#f5f6f6]'}`}
                                                >
                                                    <span>{filter.label}</span>
                                                    <span className="text-gray-400 font-normal">{filter.count}</span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>


                    </div>

                    {/* Chats */}
                    <ChatSidebar
                        loading={loading}
                        searchTerm={searchTerm}
                        activeFilter={activeFilter}
                        selectedLabelFilter={selectedLabelFilter}
                        chatScope={chatScope}
                        activeCustomListName={selectedList?.name || null}
                        presenceByJid={presenceByJid}
                        avatarErrors={avatarErrors}
                        menuOpenChatId={menuOpenChatId}
                        isFavoriteChat={isFavoriteChat}
                        onAvatarError={(remoteJid) => setAvatarErrors((prev) => ({ ...prev, [remoteJid]: true }))}
                        onToggleMenu={(chatId) => setMenuOpenChatId((prev) => (prev === chatId ? null : chatId))}
                        onMenuAction={handleChatMenuAction}
                    />
                </div>
                )}

                {/* Main Content - Chat Window */}
                <div className={`${isMobile ? (selectedChat ? 'w-full' : 'hidden') : 'flex-1'} flex flex-col h-full bg-gray-100 relative overflow-hidden`}>

                    {selectedChat ? (
                        <>
                            <InboxHeader
                                selectedChat={selectedChat}
                                isMobile={isMobile}
                                isTyping={isTyping}
                                avatarErrors={avatarErrors}
                                isChatMenuOpen={isChatMenuOpen}
                                isSyncingAvatar={isSyncingAvatar}
                                onBack={() => setSelectedChat(null)}
                                onSearchClick={() => {
                                    /* Search logic remains in page.tsx for now as it uses complex states */
                                    const nextText = window.prompt('Buscar texto:', historyFilters.search || searchQuery || '');
                                    if (nextText === null) return;
                                    const nextFilters = { ...historyFilters, search: nextText.trim() || undefined };
                                    setSearchQuery(nextText.trim());
                                    setHistoryFilters(nextFilters);
                                    loadHistory(selectedChat.phone, selectedChat.instance_name, selectedChat.remote_jid, { reset: true, filters: nextFilters }, selectedChat.chat_id);
                                }}
                                onToggleMenu={() => setIsChatMenuOpen(!isChatMenuOpen)}
                                onSyncAvatar={handleSyncAvatar}
                                onSyncMetadata={handleSyncGroup}
                                onAvatarError={(jid) => setAvatarErrors(prev => ({ ...prev, [jid]: true }))}
                            />

                            <MessageArea
                                scrollRef={scrollRef}
                                onScroll={() => {
                                    // Called by Virtuoso startReached — load older messages
                                    if (msgLoading || historyLoadingMore || !hasMoreHistory || !selectedChat) return;
                                    loadHistory(selectedChat.phone, selectedChat.instance_name, selectedChat.remote_jid, {
                                        reset: false,
                                        filters: historyFilters,
                                    }, selectedChat.chat_id);
                                }}
                                msgLoading={msgLoading}
                                historyLoadingMore={historyLoadingMore}
                                hasMoreHistory={hasMoreHistory}
                                reactionPickerFor={reactionPickerFor}
                                onReply={(msg) => setReplyingTo(msg)}
                                onToggleReactionPicker={(id) => setReactionPickerFor(prev => prev === id ? null : id)}
                                onReact={handleReactToMessage}
                                onForward={handleForwardMessage}
                                onDelete={handleDeleteMessage}
                                onEdit={handleEditMessage}
                                quickReactions={quickReactions}
                                getGroupSenderLabel={(msg) => {
                                    if (msg.direction === 'out') return 'Você';
                                    const payload = msg.message_payload || {};
                                    return String(payload?.senderName || payload?.pushName || msg.participant || 'Participante');
                                }}
                            />

                            <InputBar
                                newMessage={newMessage}
                                onNewMessageChange={setNewMessage}
                                onSend={handleSendMessage}
                                onPresence={handleTyping}
                                onSendMedia={handleSendMedia}
                                onSendAudio={handleSendAudio}
                                replyingTo={replyingTo}
                                onCancelReply={() => setReplyingTo(null)}
                                isMobile={isMobile}
                                selectedChat={selectedChat}
                            />
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-10 relative bg-gray-50 border-l border-gray-200">
                            <div className="flex flex-col items-center justify-center max-w-md -mt-10">
                                <div className="mb-6 pointer-events-none opacity-50 bg-gray-100 p-8 rounded-full">
                                    <MessageSquare className="w-12 h-12 text-gray-400" />
                                </div>
                                <h1 className="text-xl font-medium text-gray-700 mb-2">WhatsApp Web</h1>
                                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                                    Envie e receba mensagens sem manter seu celular conectado à internet.<br/>
                                    Use o WhatsApp em até 4 dispositivos conectados e 1 celular ao mesmo tempo.
                                </p>

                                <div className="mt-4 bg-green-100 border border-green-300 text-green-700 px-6 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                                    70 dias restantes no seu plano
                                </div>
                            </div>

                            <div className="absolute bottom-10 flex flex-col items-center gap-1">
                                <p className="flex items-center gap-1.5 text-[14px] text-gray-400">
                                    <Lock className="w-3 h-3" />
                                    Criptografada de ponta a ponta
                                </p>
                                <p className="text-[12px] text-gray-400/60 mt-4">
                                    Pressione <span className="text-[#667781] font-bold">ESC</span> para fechar o chat
                                </p>
                            </div>
                        </div>
                    )}
                    {/* Forward Modal */}
                    <AnimatePresence>
                        {isForwardModalOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                                    onClick={() => setIsForwardModalOpen(false)}
                                />
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
                                >
                                    <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/50">
                                        <h2 className="text-xl font-bold text-gray-800">Encaminhar para...</h2>
                                        <button onClick={() => setIsForwardModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                        {chats.slice(0, 20).map(chat => (
                                            <button
                                                key={chat.id}
                                                onClick={() => executeForward([chat])}
                                                className="w-full flex items-center gap-4 p-3 hover:bg-blue-50/50 transition-all rounded-xl border border-transparent hover:border-blue-100 group"
                                            >
                                                <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden shrink-0 border border-black/5">
                                                    {chat.avatar_url ? (
                                                        <img src={chat.avatar_url} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center font-bold bg-blue-50 text-blue-500">
                                                            {getAvatarInitials(chat)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="font-bold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                                                        {chat.lead_name || chat.subject || formatPhone(chat.phone, chat.remote_jid)}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">{chat.remote_jid}</p>
                                                </div>
                                                <Forward className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-4 bg-gray-50/50 border-t flex justify-end">
                                        <button
                                            onClick={() => setIsForwardModalOpen(false)}
                                            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all active:scale-95"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* New Conversation Modal */}
            <NewConversationModal
                isOpen={isNewConvoModalOpen}
                onClose={() => setIsNewConvoModalOpen(false)}
                onSent={handleNewConvoSent}
                activeInstance={mappedActiveInstance}
                connectedInstances={connectedInstances}
                sendMessage={async (instanceId, phone, text) => {
                    const result = await whatsappService.sendText(instanceId, phone, text);
                    return { ok: result?.ok === true || !!result?.messageId, messageId: result?.messageId };
                }}
            />
        </div>
    );
}
