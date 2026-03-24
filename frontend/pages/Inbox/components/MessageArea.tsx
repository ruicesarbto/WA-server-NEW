'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import { isSameDay, format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeJid } from '../utils';
import { Message } from '../types';
import { useChatStore } from "@/store/chatStore";

interface MessageAreaProps {
    messages: Message[];
    selectedChat: any;
    scrollRef: React.RefObject<HTMLDivElement>;
    onScroll: () => void;
    msgLoading: boolean;
    historyLoadingMore: boolean;
    hasMoreHistory: boolean;
    reactionPickerFor: string | null;
    onReply: (msg: Message) => void;
    onToggleReactionPicker: (msgId: string) => void;
    onReact: (msg: Message, emoji: string) => void;
    onForward?: (msg: Message) => void;
    onDelete?: (msg: Message) => void;
    onStar?: (msg: Message) => void;
    onEdit?: (msg: Message) => void;
    quickReactions: string[];
    getGroupSenderLabel: (msg: Message) => string;
}

export default function MessageArea({
    scrollRef,
    onScroll,
    msgLoading,
    historyLoadingMore,
    hasMoreHistory,
    reactionPickerFor,
    onReply,
    onToggleReactionPicker,
    onReact,
    onForward,
    onDelete,
    onStar,
    onEdit,
    quickReactions,
    getGroupSenderLabel,
}: Omit<MessageAreaProps, 'messages' | 'selectedChat'>) {
    const activeChatId = useChatStore((state: any) => (state as any).activeChatId);
    const messages = useChatStore((state: any) => (state as any).messages[activeChatId] || []);
    const chatsMap = useChatStore((state: any) => (state as any).chats);
    const selectedChat = chatsMap[activeChatId] || null;

    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const lastScrollTop = useRef(0);

    const handleInternalScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setShowScrollBottom(!isAtBottom);

        // Trigger parent onScroll (for infinite loading etc)
        onScroll();
        lastScrollTop.current = el.scrollTop;
    }, [onScroll, scrollRef]);

    const scrollToBottom = () => {
        const el = scrollRef.current;
        if (el) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    };

    const formatDateSeparator = (date: Date) => {
        if (isToday(date)) return 'Hoje';
        if (isYesterday(date)) return 'Ontem';
        return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    };

    const isGroupChat = Boolean(selectedChat?.remote_jid?.endsWith('@g.us'));

    // Auto-scroll to bottom on new messages if already at bottom
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;
        if (isNearBottom) {
            setTimeout(() => {
                el.scrollTop = el.scrollHeight;
            }, 100);
        }
    }, [messages.length, scrollRef]);

    return (
        <div className="flex-1 relative flex flex-col min-h-0 bg-[#efeae2] overflow-hidden">
            {/* Background Pattern - Optional Overlay if desired */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/gi_TYtZ_D-W.png')] z-0" />

            <div
                className="flex-1 overflow-y-auto px-4 md:px-14 py-6 flex flex-col custom-scrollbar relative z-10 scroll-smooth"
                ref={scrollRef}
                onScroll={handleInternalScroll}
            >
                {/* Loader for history */}
                {historyLoadingMore && (
                    <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                )}

                {(() => {
                    const seen = new Set<string>();
                    return messages
                        .filter((m: any) => {
                            const key = m.message_id || m.id?.toString();
                            if (!key || seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        })
                        .map((msg: any, idx: number) => {
                            const msgDate = new Date(msg.timestamp);
                            const prevMsg = messages[idx - 1];
                            const showDateSeparator = !prevMsg || !isSameDay(new Date(prevMsg.timestamp), msgDate);

                            const senderLabel = isGroupChat ? getGroupSenderLabel(msg) : '';

                            // Resolve Quoted Sender
                            let quotedSenderLabel = 'Mensagem';
                            if (msg.quoted_participant) {
                                const qp = normalizeJid(msg.quoted_participant);
                                const chatJid = normalizeJid(selectedChat?.remote_jid || '');
                                if (qp === chatJid) quotedSenderLabel = selectedChat?.subject || 'Contato';
                                else quotedSenderLabel = 'Você';
                            }

                            return (
                                <React.Fragment key={msg.message_id || msg.id}>
                                    {showDateSeparator && (
                                        <div className="flex justify-center my-6">
                                            <span className="px-3 py-1 bg-white text-[#54656f] text-[12.5px] font-normal uppercase tracking-tight rounded-lg shadow-sm border border-[#d1d7db]">
                                                {formatDateSeparator(msgDate)}
                                            </span>
                                        </div>
                                    )}

                                    <MessageBubble
                                        msg={msg}
                                        isGroupChat={isGroupChat}
                                        senderLabel={senderLabel}
                                        quotedSenderLabel={quotedSenderLabel}
                                        quotedPreviewText={msg.quoted_message_text || 'Mídia'}
                                        reactionPickerFor={reactionPickerFor}
                                        onReply={onReply}
                                        onToggleReactionPicker={onToggleReactionPicker}
                                        onReact={onReact}
                                        onForward={onForward}
                                        onDelete={onDelete}
                                        onStar={onStar}
                                        onEdit={onEdit}
                                        quickReactions={quickReactions}
                                    />
                                </React.Fragment>
                            );
                        });
                })()}

                {/* Bottom Anchor */}
                <div className="h-2 w-full shrink-0" />
            </div>

            {/* Scroll to Bottom Button */}
            <AnimatePresence>
                {showScrollBottom && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        onClick={scrollToBottom}
                        className="absolute bottom-6 right-6 w-11 h-11 bg-white text-[#54656f] rounded-full shadow-lg flex items-center justify-center hover:bg-[#f0f2f5] transition-all z-30 border border-[#d1d7db] active:scale-90"
                    >
                        <ArrowDown className="w-5 h-5" />
                        {selectedChat?.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-[#00a884] text-white text-[10px] min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full font-bold border-2 border-white shadow-sm">
                                {selectedChat.unread_count}
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Initial Loading Overlay */}
            {msgLoading && messages.length === 0 && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-[3px] border-[#00a884]/20 border-t-[#00a884] rounded-full animate-spin" />
                        <span className="text-[12px] font-medium text-[#667781]">Carregando mensagens...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
