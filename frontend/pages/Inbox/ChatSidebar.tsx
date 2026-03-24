'use client';

import React, { useMemo, useState, useRef } from 'react';
import {
    MessageCircle, Clock, Check, CheckCheck, AlertCircle, Pin, VolumeX,
    RefreshCw, Star, StarOff, Archive, ArchiveRestore, Trash2,
    Ban, Tag, MailOpen, Volume2, PinOff, Search, ChevronDown, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWhatsAppStore, type WhatsAppChat, type PresenceState } from './whatsappStore';
import { useChatStore } from "@/store/chatStore";
import { useEffect } from 'react';

interface ChatSidebarProps {
    chats: WhatsAppChat[];
    loading: boolean;
    selectedChat: WhatsAppChat | null;
    searchTerm: string;
    selectedLabelFilter: string | null;
    activeFilter: string;
    chatScope: 'inbox' | 'favorites' | 'archived' | 'custom_list';
    activeCustomListName?: string | null;
    presenceByJid: Record<string, PresenceState>;
    avatarErrors: Record<string, boolean>;
    menuOpenChatId: number | null;
    isFavoriteChat: (chat: WhatsAppChat) => boolean;
    onSelectChat: (chat: WhatsAppChat) => void;
    onAvatarError: (remoteJid: string) => void;
    onToggleMenu: (chatId: number) => void;
    onMenuAction: (action: 'archive' | 'mute' | 'pin' | 'mark_read' | 'block' | 'delete' | 'favorite' | 'list_add' | 'list_remove' | 'sync_group', chat: WhatsAppChat) => void;
    drafts?: Record<string, string>;
}

import {
    normalizeJid,
    formatPhone,
    getAvatarInitials,
    getAvatarColor,
    isGenericGroupSubject,
    getAvatarProxyUrl,
    formatChatDate,
    getMediaPreview
} from './utils';

// Menu size estimates for smart positioning
const MENU_W = 224; // w-56
const MENU_H = 460; // ~11 items × 40px + padding

const renderLastStatus = (chat: WhatsAppChat) => {
    if (!chat.last_message_from_me) return null;
    switch (chat.last_message_status) {
        case 'pending':
        case 'sending':
            return <Clock className="w-3 h-3 text-[#8696a0] flex-shrink-0" />;
        case 'sent':
            return <Check className="w-3.5 h-3.5 text-[#8696a0] flex-shrink-0" />;
        case 'delivered':
            return <CheckCheck className="w-3.5 h-3.5 text-[#8696a0] flex-shrink-0" />;
        case 'read':
            return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] flex-shrink-0" />;
        case 'failed':
            return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
        default:
            return null;
    }
};

const renderMessagePreview = (chat: WhatsAppChat, draft?: string) => {
    if (draft) return <span className="text-[#00a884] italic">Rascunho: {draft}</span>;

    const media = getMediaPreview(chat.last_message_type || 'text', chat.last_message_text || undefined);
    const prefix = chat.remote_jid.endsWith('@g.us') ? (
        chat.last_message_from_me ? 'Você: ' : (chat.last_message_participant_name ? `${chat.last_message_participant_name}: ` : '')
    ) : '';

    if (media) {
        return (
            <span className="flex items-center gap-1 min-w-0">
                <span className="text-[13px]">{media.icon}</span>
                <span className="truncate">{prefix}{media.label}</span>
            </span>
        );
    }

    return <span className="truncate">{prefix}{chat.last_message_text || ''}</span>;
};

const ChatItem = React.memo(({
    chat,
    isSelected,
    onSelect,
    onContextMenu,
    isMuted,
    isPresenceLive,
    presenceState,
    draft,
    avatarProxyUrl,
    onAvatarError,
    avatarErrors = {}
}: any) => {
    const canRenderAvatarImage = !!avatarProxyUrl && !avatarErrors[chat.remote_jid];
    const hasUnread = chat.unread_count > 0;

    return (
        <button
            onClick={() => onSelect(chat)}
            onContextMenu={(e) => onContextMenu(e, chat)}
            className={`w-full flex items-center gap-3 px-3 min-h-[72px] transition-all text-[#111b21] group outline-none relative overflow-hidden ${isSelected ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}
        >
            <div className="relative flex-shrink-0">
                <div className="w-[49px] h-[49px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-black/5">
                    {canRenderAvatarImage ? (
                        <img
                            src={avatarProxyUrl!}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                onAvatarError(chat.remote_jid);
                            }}
                        />
                    ) : (
                        <span
                            style={{ backgroundColor: getAvatarColor(chat.remote_jid || chat.phone) }}
                            className="w-full h-full flex items-center justify-center text-white text-base font-semibold"
                        >
                            {getAvatarInitials(chat)}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center border-b border-[#f0f2f5] self-stretch py-2 group-last:border-none pr-1">
                {/* Top Row: Name and Timestamp */}
                <div className="flex items-center justify-between">
                    <h3 className={`text-[17px] leading-[1.3] truncate ${hasUnread ? 'font-bold' : 'font-normal'} text-[#111b21]`}>
                        {chat.displayName}
                    </h3>
                    <div className={`text-[12px] leading-[14px] flex-shrink-0 ml-2 ${hasUnread ? 'text-[#00a884]' : 'text-[#667781]'}`}>
                        {formatChatDate(chat.last_message_time)}
                    </div>
                </div>
                
                {/* Bottom Row: Message Preview and Status Icons */}
                <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                        {(() => {
                            if (isPresenceLive && (presenceState === 'composing' || presenceState === 'recording')) {
                                return (
                                    <p className="text-[13px] text-[#00a884] font-normal truncate italic">
                                        {presenceState === 'recording' ? 'gravando áudio...' : 'digitando...'}
                                    </p>
                                );
                            }
                            return (
                                <div className="flex items-center gap-1 min-w-0 text-[13px] leading-[20px] text-[#667781] font-normal">
                                    {!draft && renderLastStatus(chat)}
                                    {renderMessagePreview(chat, draft)}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                        {isMuted && <VolumeX className="w-4 h-4 text-[#8696a0]" />}
                        {Boolean(chat.is_pinned) && <Pin className="w-4 h-4 text-[#8696a0]" />}
                        {hasUnread && (
                            <span className="bg-[#00a884] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] h-5 flex items-center justify-center shadow-sm">
                                {chat.unread_count}
                            </span>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <ChevronDown className="w-5 h-5 text-[#8696a0]" />
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
});

export default function ChatSidebar({
    loading,
    searchTerm,
    selectedLabelFilter,
    activeFilter,
    chatScope,
    activeCustomListName,
    presenceByJid,
    avatarErrors,
    isFavoriteChat,
    onAvatarError,
    onMenuAction,
    drafts = {},
}: Omit<ChatSidebarProps, 'chats' | 'selectedChat' | 'onSelectChat'>) {
    const chats = useWhatsAppStore((state) => state.chats);
    const activeChatId = useChatStore((state: any) => (state as any).activeChatId);
    const setActiveChat = useChatStore((state: any) => (state as any).setActiveChat);

    const selectedChat = useMemo(() => chats.find(c => c.remote_jid === activeChatId) || null, [chats, activeChatId]);

    const onSelectChat = (chat: any) => setActiveChat(chat.remote_jid);

    // Pill filters
    const [pillFilter, setPillFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        chat: WhatsAppChat;
        x: number;
        y: number;
    } | null>(null);

    const filteredChats = useMemo(() => chats.filter((chat) => {
        const isGroup = chat.remote_jid.endsWith('@g.us');
        
        // Filter by pill
        if (pillFilter === 'unread' && chat.unread_count === 0) return false;
        if (pillFilter === 'groups' && !isGroup) return false;
        if (pillFilter === 'favorites' && !isFavoriteChat(chat)) return false;

        const displayName = chat.displayName || chat.subject || chat.phone || chat.remote_jid;
        const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (chat.last_message_text || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesLabel = !selectedLabelFilter ||
            (chat.labels && chat.labels.some((l: any) => l.label_id === selectedLabelFilter));

        return matchesSearch && matchesLabel;
    }), [chats, searchTerm, selectedLabelFilter, pillFilter, activeFilter, isFavoriteChat]);

    const sortedFilteredChats = useMemo(
        () => [...filteredChats].sort((a, b) => {
            const aPinned = Boolean(a.is_pinned);
            const bPinned = Boolean(b.is_pinned);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            return new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime();
        }),
        [filteredChats]
    );

    const handleContextMenu = (e: React.MouseEvent, chat: WhatsAppChat) => {
        e.preventDefault();
        e.stopPropagation();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = e.clientX;
        let y = e.clientY;
        if (x + MENU_W > vw) x = Math.max(4, e.clientX - MENU_W);
        if (y + MENU_H > vh) y = Math.max(4, vh - MENU_H);
        setContextMenu({ chat, x, y });
    };

    const buildMenuItems = (chat: WhatsAppChat) => {
        const isMuted = Boolean(chat.muted_until && new Date(chat.muted_until).getTime() > Date.now());
        const isPinned = Boolean(chat.is_pinned);
        const isArchived = Boolean(chat.is_archived);
        const isGroup = chat.remote_jid.endsWith('@g.us');
        const isFav = isFavoriteChat(chat);

        return [
            {
                key: 'favorite' as const,
                label: isFav ? 'Remover favorito' : 'Favoritar',
                icon: isFav ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />,
            },
            {
                key: 'list_add' as const,
                label: 'Adicionar em lista...',
                icon: <Tag className="w-4 h-4" />,
            },
            ...(chatScope === 'custom_list' && activeCustomListName
                ? [{ key: 'list_remove' as const, label: `Remover de "${activeCustomListName}"`, icon: <Tag className="w-4 h-4 opacity-50" /> }]
                : []),
            {
                key: 'archive' as const,
                label: isArchived ? 'Desarquivar conversa' : 'Arquivar conversa',
                icon: isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />,
            },
            {
                key: 'mute' as const,
                label: isMuted ? 'Ativar notificações' : 'Silenciar notificações',
                icon: isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />,
            },
            {
                key: 'pin' as const,
                label: isPinned ? 'Desafixar conversa' : 'Fixar conversa',
                icon: isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
            },
            {
                key: 'mark_read' as const,
                label: 'Marcar como lida',
                icon: <MailOpen className="w-4 h-4" />,
            },
            ...(isGroup ? [{ key: 'sync_group' as const, label: 'Sincronizar grupo', icon: <RefreshCw className="w-4 h-4" /> }] : []),
            {
                key: 'block' as const,
                label: 'Bloquear contato',
                icon: <Ban className="w-4 h-4" />,
                danger: true,
            },
            {
                key: 'delete' as const,
                label: 'Apagar conversa',
                icon: <Trash2 className="w-4 h-4" />,
                danger: true,
            },
        ];
    };

    return (
        <>
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-8 h-8 border-3 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : sortedFilteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 px-10 text-center">
                        <div className="w-16 h-16 bg-[#f0f2f5] rounded-full flex items-center justify-center mb-4">
                            <MessageCircle className="w-8 h-8 text-[#8696a0]" />
                        </div>
                        <p className="text-[#667781] text-sm">Nenhuma conversa encontrada</p>
                    </div>
                ) : (
                    sortedFilteredChats.map((chat) => {
                        const avatarProxyUrl = getAvatarProxyUrl(chat, 'contact');
                        const isMuted = Boolean(chat.muted_until && new Date(chat.muted_until).getTime() > Date.now());
                        const jid = normalizeJid(chat.remote_jid);
                        const p = presenceByJid[jid];
                        const isPresenceLive = p && (Date.now() - p.ts) <= 6000;

                        return (
                            <ChatItem
                                key={chat.id}
                                chat={chat}
                                isSelected={selectedChat?.id === chat.id}
                                onSelect={onSelectChat}
                                onContextMenu={handleContextMenu}
                                isMuted={isMuted}
                                isPresenceLive={isPresenceLive}
                                presenceState={p?.state}
                                draft={drafts[jid]}
                                avatarProxyUrl={avatarProxyUrl}
                                onAvatarError={onAvatarError}
                                avatarErrors={avatarErrors}
                            />
                        );
                    })
                )}
            </div>

            {/* Context Menu — fixed position, opens toward best direction */}
            <AnimatePresence>
                {contextMenu && (
                    <>
                        {/* Invisible overlay to capture outside clicks */}
                        <div
                            className="fixed inset-0 z-[199]"
                            onMouseDown={() => setContextMenu(null)}
                        />
                        <motion.div
                            key={contextMenu.chat.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            className="fixed w-56 bg-white rounded-lg shadow-2xl border border-gray-100 py-1.5 z-[200]"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {buildMenuItems(contextMenu.chat).map((item) => (
                                <button
                                    key={item.key}
                                    className={`w-full text-left px-4 py-2.5 text-[13.5px] font-normal flex items-center gap-3 transition-colors ${item.danger
                                            ? 'text-red-600 hover:bg-red-50'
                                            : 'text-[#3b4a54] hover:bg-[#f5f6f6]'
                                        }`}
                                    onClick={() => {
                                        onMenuAction(item.key, contextMenu.chat);
                                        setContextMenu(null);
                                    }}
                                >
                                    <span className="text-[#8696a0]">{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
