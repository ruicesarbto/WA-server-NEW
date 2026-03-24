'use client';

import React, { useMemo } from 'react';
import {
    Check,
    CheckCheck,
    AlertCircle,
    ImageIcon,
    Video,
    FileText,
    Mic,
    Reply,
    MoreHorizontal,
    ChevronDown,
    Forward,
    Star,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Message } from '../types';
import { normalizeJid, formatPhone, getMediaUrl } from '../utils';
import LinkPreview, { extractFirstUrl, renderTextWithLinks } from './LinkPreview';

// Message interface removed and moved to types.ts

interface MessageBubbleProps {
    msg: Message;
    isGroupChat: boolean;
    senderLabel: string;
    quotedSenderLabel?: string;
    quotedPreviewText?: string;
    reactionPickerFor: string | null;
    onReply: (msg: Message) => void;
    onToggleReactionPicker: (msgId: string) => void;
    onReact: (msg: Message, emoji: string) => void;
    onForward?: (msg: Message) => void;
    onDelete?: (msg: Message) => void;
    onStar?: (msg: Message) => void;
    onEdit?: (msg: Message) => void;
    quickReactions: string[];
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
    msg,
    isGroupChat,
    senderLabel,
    quotedSenderLabel,
    quotedPreviewText,
    reactionPickerFor,
    onReply,
    onToggleReactionPicker,
    onReact,
    onForward,
    onDelete,
    onStar,
    onEdit,
    quickReactions,
}) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const isOut = msg.direction === 'out';
    const showActionsLeft = isOut;
    const showActionsRight = !isOut;
    // ... rest of the component ...
    const renderMessageStatus = (status: string) => {
        switch (status) {
            case 'sending':
            case 'pending':
                return <Check className="w-3.5 h-3.5 text-[#8696a0]" />;
            case 'sent':
                return <Check className="w-3.5 h-3.5 text-[#8696a0]" />;
            case 'delivered':
                return <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />;
            case 'read':
                return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
            case 'failed':
                return <span title="Falha no envio"><AlertCircle className="w-3.5 h-3.5 text-[#ef4444]" /></span>;
            default:
                return null;
        }
    };

    const renderMessageContent = () => {
        const fullMediaUrl = getMediaUrl(msg.media_url);

        switch (msg.type) {
            case 'image':
                return (
                    <div className="relative rounded-lg overflow-hidden cursor-pointer group/media">
                        {fullMediaUrl ? (
                            <img
                                src={fullMediaUrl}
                                alt="Media"
                                className="max-w-full max-h-[300px] object-cover transition-transform group-hover/media:scale-[1.02]"
                                onClick={() => window.open(fullMediaUrl, '_blank')}
                            />
                        ) : (
                            <div className="flex items-center justify-center w-48 h-32 bg-white/5 rounded-lg border border-white/5">
                                <ImageIcon className="w-8 h-8 text-slate-600" />
                            </div>
                        )}
                        {msg.text && <p className="mt-2 text-sm leading-relaxed">{msg.text}</p>}
                    </div>
                );
            case 'video':
                return (
                    <div className="relative rounded-lg overflow-hidden bg-black/10 flex items-center justify-center min-h-[150px] cursor-pointer" onClick={() => fullMediaUrl && window.open(fullMediaUrl, '_blank')}>
                        <div className="absolute inset-0 flex items-center justify-center hover:bg-black/20 transition-colors">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                                <Video className="w-6 h-6 fill-current" />
                            </div>
                        </div>
                    </div>
                );
            case 'audio':
            case 'ptt':
                return (
                    <div className="flex items-center gap-3 bg-[#f0f2f5] p-2 rounded-xl border border-black/5 w-[260px]">
                        <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-white shrink-0 shadow-sm relative">
                            <Mic className="w-5 h-5" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="h-0.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#00a884] w-0" />
                            </div>
                            <div className="flex justify-between text-[11px] text-[#667781] font-normal uppercase">
                                <span>PTT</span>
                                <a href={fullMediaUrl || '#'} target="_blank" rel="noreferrer" className="hover:text-[#00a884] transition-colors">Ouvir</a>
                            </div>
                        </div>
                    </div>
                );
            case 'document':
                return (
                    <div
                        onClick={() => fullMediaUrl && window.open(fullMediaUrl, '_blank')}
                        className="flex items-center gap-4 bg-[#f0f2f5] p-3 rounded-xl border border-black/5 cursor-pointer hover:bg-gray-200 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 bg-[#00a884]/10 rounded-lg flex items-center justify-center text-[#00a884]">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[14px] font-normal truncate text-[#111b21]">{msg.text || 'Documento'}</span>
                            <span className="text-[11px] text-[#667781] font-normal uppercase mt-0.5">
                                {msg.media_type?.split('/')[1]?.toUpperCase() || 'FILE'} • {msg.media_size ? `${(msg.media_size / 1024).toFixed(0)}KB` : 'N/A'}
                            </span>
                        </div>
                    </div>
                );
            default: {
                return (
                    <div className="relative">
                        <p className={`text-[14.2px] break-words whitespace-pre-wrap leading-[1.6] ${isOut ? 'text-[#111b21]' : 'text-[#111b21]'}`}>
                            {msg.text ? renderTextWithLinks(msg.text) : null}
                        </p>
                    </div>
                );
            }
        }
    };

    const bubbleClasses = `px-2 py-1.5 rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative group overflow-visible transition-all ${isOut
        ? 'bg-[#d9fdd3] rounded-tr-none'
        : 'bg-white rounded-tl-none'
        }`;

    return (
        <motion.div
            id={`msg-${msg.message_id}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`flex w-full mb-3 group/row ${isOut ? 'justify-end pr-4' : 'justify-start'}`}
        >
            {showActionsLeft && (
                <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex flex-col items-center justify-center mr-2 gap-2">
                    <button onClick={() => onReply(msg)} className="p-1.5 hover:bg-white/5 rounded-full text-slate-500 transition-all hover:scale-110" title="Responder">
                        <Reply className="w-4 h-4" />
                    </button>
                    <button onClick={() => onToggleReactionPicker(msg.message_id)} className="p-1.5 hover:bg-white/5 rounded-full text-slate-500 transition-all hover:scale-110" title="Reagir">
                        <span className="text-xs">🙂</span>
                    </button>
                </div>
            )}

            <div className="flex flex-col max-w-[75%] relative">
                <div className={bubbleClasses}>
                    {/* Authentic WhatsApp Message Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`absolute top-1 right-1 p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-300 transition-opacity z-30`}
                    >
                        <ChevronDown className="w-5 h-5" />
                    </button>

                    {isGroupChat && senderLabel && !isOut && (
                        <div className="mb-1.5 text-[11px] font-black tracking-wider text-brand-400 uppercase">
                            {senderLabel}
                        </div>
                    )}

                    {/* Quoted Message */}
                    {(msg.quoted_message_id || msg.quoted_id) && (
                        <div className={`mb-2 p-2 rounded-lg border-l-[4px] border-[#00a884] text-[13px] cursor-pointer ${isOut ? 'bg-black/5' : 'bg-[#f0f2f5]'} hover:bg-black/10 transition-colors`}
                            onClick={() => {
                                const targetId = msg.quoted_message_id || msg.quoted_id;
                                const el = targetId ? document.getElementById(`msg-${targetId}`) : null;
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.classList.add('bg-[#00a884]/20');
                                    setTimeout(() => el.classList.remove('bg-[#00a884]/20'), 1500);
                                }
                            }}
                        >
                            <div className="font-bold text-[#00a884] mb-0.5 truncate">
                                {quotedSenderLabel}
                            </div>
                            <div className="text-[#667781] truncate">
                                {quotedPreviewText}
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        {renderMessageContent()}
                        <div className={`flex items-center justify-end gap-1 -mt-2 -mr-1 float-right relative z-10 pl-4 pb-0.5`}>
                            <span className="text-[11px] text-[#667781] font-normal leading-[14px]">
                                {format(new Date(msg.timestamp), 'HH:mm')}
                            </span>
                            {isOut && renderMessageStatus(msg.status)}
                        </div>
                    </div>

                    {/* Context Menu Dropdown */}
                    <AnimatePresence>
                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    className={`absolute top-8 ${isOut ? 'right-2' : 'left-2'} w-48 bg-white rounded-lg shadow-2xl border border-gray-100 py-1.5 z-[100] origin-top-right`}
                                >
                                    {[
                                        { label: 'Responder', icon: <Reply className="w-4 h-4" />, onClick: () => { onReply(msg); setIsMenuOpen(false); } },
                                        ...(isOut && msg.type === 'text' && onEdit ? [{ label: 'Editar', icon: <span className="w-4 h-4 font-bold text-xs">✎</span>, onClick: () => { onEdit(msg); setIsMenuOpen(false); } }] : []),
                                        { label: 'Encaminhar', icon: <Forward className="w-4 h-4" />, onClick: () => { onForward?.(msg); setIsMenuOpen(false); } },
                                        { label: 'Favoritar', icon: <Star className="w-4 h-4" />, onClick: () => { onStar?.(msg); setIsMenuOpen(false); } },
                                        { label: 'Apagar', icon: <Trash2 className="w-4 h-4" />, onClick: () => { onDelete?.(msg); setIsMenuOpen(false); }, danger: true },
                                    ].map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={item.onClick}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-colors ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-white/5'}`}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Reaction Picker Popover */}
                    <AnimatePresence>
                        {reactionPickerFor === msg.message_id && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => onToggleReactionPicker('')} />
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                >
                                    <div className={`absolute top-[calc(100%+8px)] ${isOut ? 'right-0 origin-top-right' : 'left-0 origin-top'} z-[100] flex animate-in fade-in zoom-in duration-200`}>
                                        <div className="flex items-center gap-1.5 p-2 bg-[#111b21] rounded-full shadow-2xl border border-white/10 backdrop-blur-xl">
                                            {quickReactions.map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReact(msg, emoji);
                                                        onToggleReactionPicker('');
                                                    }}
                                                    className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all hover:scale-125 active:scale-95 text-2xl"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Visible Reactions Badge */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`mt-1 flex ${isOut ? 'justify-end mr-2' : 'justify-start ml-2'}`}
                    >
                        <div className="flex items-center bg-[#111b21] rounded-full px-2.5 py-1 shadow-2xl border border-white/5 gap-1.5 z-10 hover:scale-105 transition-transform cursor-pointer ring-1 ring-white/10 backdrop-blur-xl">
                            {Object.entries(msg.reactions).slice(0, 3).map(([sender, emoji], idx) => (
                                <span key={idx} title={sender} className="text-[13px]">{emoji}</span>
                            ))}
                            {Object.keys(msg.reactions).length > 3 && (
                                <span className="text-[10px] text-slate-500 font-black">+{Object.keys(msg.reactions).length - 3}</span>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>

            {showActionsRight && (
                <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex flex-col items-center justify-center ml-2 gap-2">
                    <button onClick={() => onReply(msg)} className="p-1.5 hover:bg-white/5 rounded-full text-slate-500 transition-all hover:scale-110" title="Responder">
                        <Reply className="w-4 h-4" />
                    </button>
                    <button onClick={() => onToggleReactionPicker(msg.message_id)} className="p-1.5 hover:bg-white/5 rounded-full text-slate-500 transition-all hover:scale-110" title="Reagir">
                        <span className="text-xs">🙃</span>
                    </button>
                </div>
            )}
        </motion.div>
    );
});

export default MessageBubble;
