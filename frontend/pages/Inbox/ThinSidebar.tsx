import React from 'react';
import {
    MessageCircle,
    Megaphone,
    Users,
    Settings,
    MoreVertical
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { WhatsAppChat, useWhatsAppStore } from './whatsappStore';
import { getAvatarProxyUrl } from './utils';

export type TabType = 'chats' | 'broadcasts' | 'groups' | 'settings';

interface ThinSidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    activeInstance: any; // We'll pass the active instance to show the avatar
}

export default function ThinSidebar({ activeTab, setActiveTab, activeInstance }: ThinSidebarProps) {
    const isConnected = activeInstance?.status === 'connected';
    const router = useRouter();

    const renderIcon = (id: TabType, IconComponent: any, title: string) => {
        const isActive = activeTab === id;
        return (
            <button
                key={id}
                title={title}
                onClick={() => setActiveTab(id)}
                className={`w-10 h-10 mb-2 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-[#d9dbdf]' : 'hover:bg-[#d9dbdf]/60'
                }`}
            >
                <IconComponent
                    className={`w-6 h-6 ${isActive ? 'text-[#111b21]' : 'text-[#54656f]'}`}
                    fill={isActive ? 'currentColor' : 'none'}
                />
            </button>
        );
    };

    return (
        <div className="w-[60px] h-full bg-[#f0f2f5] border-r border-[#d1d7db] flex flex-col items-center py-4 flex-shrink-0 z-30">
            {/* Top Icons */}
            <div className="flex-1 w-full flex flex-col items-center">
                {renderIcon('chats', MessageCircle, 'Conversas')}
                {renderIcon('broadcasts', Megaphone, 'Transmissões')}
                {renderIcon('groups', Users, 'Comunidades/Grupos')}
            </div>

            {/* Bottom Icons */}
            <div className="w-full flex flex-col items-center pb-2">
                <button
                    title="Sessões / Instâncias"
                    onClick={() => router.push('/sessions')}
                    className={`w-10 h-10 mb-2 rounded-full flex items-center justify-center transition-colors hover:bg-[#d9dbdf]/60`}
                >
                    <Settings className="w-6 h-6 text-[#54656f]" />
                </button>
                
                <div className="relative mt-2 p-1 cursor-pointer">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 border border-gray-300">
                        {activeInstance?.instance ? (
                            <img
                                src={getAvatarProxyUrl({ instance: activeInstance.instance } as any, 'instance') || activeInstance.avatar || activeInstance.profilePictureUrl || ''}
                                alt="Status"
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#dfe5e7] text-[#54656f]">
                                <Users className="w-5 h-5" />
                            </div>
                        )}
                    </div>
                    {/* Status indicator badge */}
                    <div
                        className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-[#f0f2f5] ${
                            isConnected ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        title={isConnected ? 'Conectado' : 'Desconectado'}
                    ></div>
                </div>
            </div>
        </div>
    );
}
