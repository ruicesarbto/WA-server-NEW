'use client';

import React from 'react';
import {
    ArrowLeft,
    Search,
    MoreVertical,
    RefreshCw,
    Tag,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    normalizeJid,
    formatPhone,
    getAvatarInitials,
    getAvatarColor,
    getLabelColor,
    getAvatarProxyUrl
} from '../utils';

interface InboxHeaderProps {
    selectedChat: any;
    isMobile: boolean;
    isTyping: boolean;
    avatarErrors: Record<string, boolean>;
    isChatMenuOpen: boolean;
    isSyncingAvatar: boolean;
    onBack: () => void;
    onSearchClick: () => void;
    onToggleMenu: () => void;
    onSyncAvatar: () => void;
    onSyncMetadata?: () => void;
    onAvatarError: (remoteJid: string) => void;
}

const InboxHeader: React.FC<InboxHeaderProps> = ({
    selectedChat,
    isMobile,
    isTyping,
    avatarErrors,
    isChatMenuOpen,
    isSyncingAvatar,
    onBack,
    onSearchClick,
    onToggleMenu,
    onSyncAvatar,
    onSyncMetadata,
    onAvatarError,
}) => {
    return (
        <header className="h-[60px] px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-[#d1d7db] z-30 relative shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {isMobile && (
                    <button
                        onClick={onBack}
                        className="p-1 -ml-1 mr-1 hover:bg-black/5 rounded-full transition-colors active:scale-90"
                    >
                        <ArrowLeft className="w-6 h-6 text-[#54656f]" />
                    </button>
                )}

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-[40px] h-[40px] rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border border-black/5 cursor-pointer">
                        {(() => {
                            const proxyUrl = getAvatarProxyUrl(selectedChat, 'contact');
                            if (proxyUrl && !avatarErrors[selectedChat.remote_jid]) {
                                return (
                                    <img
                                        src={proxyUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            onAvatarError(selectedChat.remote_jid);
                                        }}
                                    />
                                );
                            }
                            return (
                                <span
                                    style={{ backgroundColor: getAvatarColor(selectedChat.remote_jid || selectedChat.phone) }}
                                    className="w-full h-full flex items-center justify-center text-white text-sm font-semibold"
                                >
                                    {getAvatarInitials(selectedChat)}
                                </span>
                            );
                        })()}
                    </div>
                </div>

                <div className="flex flex-col min-w-0">
                    <h3 className="text-[16px] leading-[21px] font-normal text-[#111b21] flex items-center gap-2 truncate">
                        {selectedChat.lead_name || selectedChat.subject || formatPhone(selectedChat.phone, selectedChat.remote_jid)}
                    </h3>

                    {isTyping ? (
                        <span className="text-[13px] text-[#00a884] font-normal">
                            digitando...
                        </span>
                    ) : (
                        <span className="text-[13px] text-[#667781] truncate max-w-[300px] font-normal">
                             {selectedChat.bio || (
                                selectedChat.remote_jid?.endsWith('@g.us')
                                    ? `Grupo • clique para info`
                                    : 'visto por último hoje às...'
                            )}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={onSearchClick}
                    className="p-2 hover:bg-black/5 rounded-full transition-all text-[#54656f] hover:text-[#111b21]"
                    title="Procurar na conversa"
                >
                    <Search className="w-5 h-5" />
                </button>

                <div className="relative">
                    <button
                        onClick={onToggleMenu}
                        className={`p-2 rounded-full transition-all ${isChatMenuOpen ? 'bg-black/10 text-[#111b21]' : 'hover:bg-black/5 text-[#54656f]'}`}
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                        {isChatMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                            >
                                <button
                                    onClick={() => {
                                        onSyncAvatar();
                                        onToggleMenu();
                                    }}
                                    disabled={isSyncingAvatar}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#111b21] hover:bg-[#f5f6f6] transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isSyncingAvatar ? 'animate-spin' : ''}`} />
                                    Sincronizar Foto
                                </button>
                                {selectedChat?.remote_jid?.endsWith('@g.us') && onSyncMetadata && (
                                    <button
                                        onClick={() => {
                                            onSyncMetadata();
                                            onToggleMenu();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#111b21] hover:bg-[#f5f6f6] transition-colors"
                                    >
                                        <RefreshCw className="w-4 h-4 text-[#00a884]" />
                                        Atualizar Nome/Grupo
                                    </button>
                                )}
                                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#111b21] hover:bg-[#f5f6f6] transition-colors">
                                    <Tag className="w-4 h-4" />
                                    Gerenciar etiquetas
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-red-600 hover:bg-red-50 transition-colors">
                                    <X className="w-4 h-4" />
                                    Limpar conversa
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
};

export default InboxHeader;
