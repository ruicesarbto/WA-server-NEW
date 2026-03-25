'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import MessageBubble from './MessageBubble';
import { isSameDay, format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeJid } from '../utils';
import { Message } from '../types';
import { useChatStore } from "@/store/chatStore";
import { chatEngine } from '@/core/chatEngine';

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
    const updateMessageStatus = useChatStore((state: any) => state.updateMessageStatus);
    const updateMessageReaction = useChatStore((state: any) => state.updateMessageReaction);

    // ── Listeners em tempo real foram migrados para chatEngine.ts para centralização ──

    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const isAtBottomRef = useRef(true);

    const formatDateSeparator = (date: Date) => {
        if (isToday(date)) return 'Hoje';
        if (isYesterday(date)) return 'Ontem';
        return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    };

    const isGroupChat = Boolean(selectedChat?.remote_jid?.endsWith('@g.us'));

    // Deduplicated messages list
    const dedupedMessages = useMemo(() => {
        const seen = new Set<string>();
        return messages.filter((m: any) => {
            const key = m.message_id || m.id?.toString();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [messages]);

    const scrollToBottom = useCallback(() => {
        virtuosoRef.current?.scrollToIndex({
            index: dedupedMessages.length - 1,
            behavior: 'smooth',
            align: 'end',
        });
    }, [dedupedMessages.length]);

    // When new messages arrive and user is at bottom, follow
    const followOutput = useCallback(() => {
        return isAtBottomRef.current ? 'smooth' : false;
    }, []);

    const handleAtBottomChange = useCallback((atBottom: boolean) => {
        isAtBottomRef.current = atBottom;
        setShowScrollBottom(!atBottom);
    }, []);

    // Load more history when scrolling to the top
    const handleStartReached = useCallback(() => {
        if (!historyLoadingMore && hasMoreHistory) {
            onScroll();
        }
    }, [historyLoadingMore, hasMoreHistory, onScroll]);

    const itemContent = useCallback((index: number) => {
        const msg = dedupedMessages[index];
        if (!msg) return null;

        const msgDate = new Date(msg.timestamp);
        const prevMsg = index > 0 ? dedupedMessages[index - 1] : null;
        const showDateSeparator = !prevMsg || !isSameDay(new Date(prevMsg.timestamp), msgDate);

        const senderLabel = isGroupChat ? getGroupSenderLabel(msg) : '';

        let quotedSenderLabel = 'Mensagem';
        if (msg.quoted_participant) {
            const qp = normalizeJid(msg.quoted_participant);
            const chatJid = normalizeJid(selectedChat?.remote_jid || '');
            if (qp === chatJid) quotedSenderLabel = selectedChat?.subject || 'Contato';
            else quotedSenderLabel = 'Voce';
        }

        return (
            <div className="px-4 md:px-14">
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
                    quotedPreviewText={msg.quoted_message_text || 'Midia'}
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
            </div>
        );
    }, [dedupedMessages, isGroupChat, selectedChat, reactionPickerFor, onReply, onToggleReactionPicker, onReact, onForward, onDelete, onStar, onEdit, quickReactions, getGroupSenderLabel]);

    return (
        <div className="flex-1 relative flex flex-col min-h-0 bg-[#efeae2] overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/gi_TYtZ_D-W.png')] z-0" />

            <div className="flex-1 relative z-10" ref={scrollRef}>
                <Virtuoso
                    ref={virtuosoRef}
                    data={dedupedMessages}
                    totalCount={dedupedMessages.length}
                    itemContent={itemContent}
                    followOutput={followOutput}
                    atBottomStateChange={handleAtBottomChange}
                    startReached={handleStartReached}
                    initialTopMostItemIndex={Math.max(0, dedupedMessages.length - 1)}
                    atBottomThreshold={100}
                    increaseViewportBy={{ top: 400, bottom: 200 }}
                    className="custom-scrollbar"
                    style={{ height: '100%' }}
                    components={{
                        Header: () => historyLoadingMore ? (
                            <div className="flex justify-center py-4">
                                <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        ) : null,
                    }}
                />
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
