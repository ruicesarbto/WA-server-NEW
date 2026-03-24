'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Inbox,
    Wifi,
    Users,
    Send,
    FileText,
    Bot,
    Flame,
    Key,
    Phone,
    BrainCircuit,
    ExternalLink,
    Terminal
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WhatsAppGlobalModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Tool {
    id: string;
    label: string;
    icon: any;
    color: string;
    href: string;
    description: string;
    external?: boolean;
}

const tools: Tool[] = [
    {
        id: 'console',
        label: 'Operation Console',
        icon: Terminal,
        color: 'bg-slate-900',
        href: '/admin/whatsapp',
        description: 'Gestão Técnica e Logs da API'
    },
    {
        id: 'inbox',
        label: 'Inbox CRM',
        icon: Inbox,
        color: 'bg-emerald-600',
        href: '/admin/whatsapp/inbox',
        description: 'Gestão de Vendas e Conversas'
    },
    {
        id: 'sessions',
        label: 'Conexões',
        icon: Wifi,
        color: 'bg-blue-500',
        href: '/admin/whatsapp/sessions',
        description: 'Status de Conexão e QR Code'
    },
    {
        id: 'contacts',
        label: 'Leads CRM',
        icon: Users,
        color: 'bg-purple-600',
        href: '/admin/leads',
        description: 'Base de Clientes Integrada'
    },
    {
        id: 'broadcast',
        label: 'Campanhas',
        icon: Send,
        color: 'bg-orange-500',
        href: '/admin/whatsapp',
        description: 'Disparos em Massa e Listas'
    },
    {
        id: 'templates',
        label: 'Templates',
        icon: FileText,
        color: 'bg-amber-500',
        href: '/admin/whatsapp',
        description: 'Modelos de Mensagens'
    },
    {
        id: 'chatbots',
        label: 'Automações',
        icon: Bot,
        color: 'bg-pink-500',
        href: '/admin/whatsapp',
        description: 'Chatbots e Fluxos de Resposta'
    },
    {
        id: 'warmer',
        label: 'Warmer',
        icon: Flame,
        color: 'bg-red-500',
        href: '#',
        description: 'Aquecimento de Chips (Logo)'
    },
    {
        id: 'api',
        label: 'Infra/API',
        icon: Key,
        color: 'bg-indigo-600',
        href: '/admin/configs?tab=infra',
        description: 'Tokens e Configuração de API'
    },
    {
        id: 'ai-bots',
        label: 'Bot IA',
        icon: BrainCircuit,
        color: 'bg-violet-600',
        href: '/admin/whatsapp/bots',
        description: 'Configurar OpenAI, Typebot e Automações',
    },
];

export default function WhatsAppGlobalModal({ isOpen, onClose }: WhatsAppGlobalModalProps) {
    const router = useRouter();
    const [isNavigating, setIsNavigating] = React.useState(false);

    // Reset navigating state when modal closes/opens
    React.useEffect(() => {
        if (!isOpen) setIsNavigating(false);
    }, [isOpen]);

    // Prefetch de todas as rotas principais ao abrir o modal para navegação instantânea
    React.useEffect(() => {
        if (isOpen) {
            tools.forEach(tool => {
                if (tool.href && tool.href !== '#' && !tool.external) {
                    router.prefetch(tool.href);
                }
            });
        }
    }, [isOpen, router]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={isNavigating ? undefined : { opacity: 0, y: 20 }}
                    transition={isNavigating ? { duration: 0 } : undefined}
                    className="fixed inset-0 z-[100] bg-white flex flex-col"
                >
                    {/* 2 — HEADER SUPERIOR */}
                    <header className="flex items-center justify-between px-10 py-6 border-b bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                <Phone className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                    Clube67 <span className="text-emerald-500">WHATSAPP</span>
                                </h2>
                                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Beyond Limits Dashboard</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="text-gray-300 hover:text-gray-900 text-3xl transition-colors p-2"
                        >
                            ✕
                        </button>
                    </header>

                    {/* 3 — ÁREA PRINCIPAL */}
                    <main className="flex-1 overflow-y-auto px-10 py-12 bg-gray-50/50">
                        {/* 4 — GRID DOS MENUS */}
                        <div className="max-w-7xl mx-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                {tools.map((tool) => {
                                    const isExternal = tool.external;
                                    const isHash = !tool.href || tool.href === '#';

                                    if (isExternal || isHash) {
                                        return (
                                            <button
                                                key={tool.id}
                                                onClick={() => {
                                                    if (isHash) return;
                                                    window.open(tool.href, '_blank', 'noopener,noreferrer');
                                                }}
                                                className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all cursor-pointer group flex flex-col items-start gap-6 hover:-translate-y-1 text-left relative overflow-hidden"
                                            >
                                                <div className="w-full flex items-start justify-between relative z-10">
                                                    <div className={`${tool.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                                                        <tool.icon className="w-8 h-8" />
                                                    </div>
                                                    {isExternal && (
                                                        <ExternalLink className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                                    )}
                                                </div>
                                                
                                                <div className="relative z-10">
                                                    <h3 className="text-xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors">
                                                        {tool.label}
                                                    </h3>
                                                    <p className="text-xs text-gray-400 mt-2 font-medium leading-relaxed uppercase tracking-tighter">
                                                        {tool.description}
                                                    </p>
                                                </div>
                                                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        );
                                    }

                                    return (
                                        <Link
                                            key={tool.id}
                                            href={tool.href}
                                            onClick={() => {
                                                setIsNavigating(true);
                                                onClose();
                                            }}
                                            onMouseEnter={() => router.prefetch(tool.href)}
                                            className="bg-white rounded-3xl border border-gray-200 p-8 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all cursor-pointer group flex flex-col items-start gap-6 hover:-translate-y-1 text-left relative overflow-hidden"
                                        >
                                            <div className="w-full flex items-start justify-between relative z-10">
                                                <div className={`${tool.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                                                    <tool.icon className="w-8 h-8" />
                                                </div>
                                            </div>
                                            
                                            <div className="relative z-10">
                                                <h3 className="text-xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors">
                                                    {tool.label}
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-2 font-medium leading-relaxed uppercase tracking-tighter">
                                                    {tool.description}
                                                </p>
                                            </div>
                                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </main>

                    {/* 6 — FOOTER */}
                    <footer className="border-t px-10 py-6 flex justify-between items-center text-xs font-bold text-gray-400 bg-white shrink-0">
                        <div>
                            <span className="px-3 py-1 bg-gray-100 rounded-md text-gray-300">V3.2 STABLE</span>
                        </div>
                        <div className="tracking-[0.3em] uppercase text-[10px]">
                            CLUBE67 • WHATSAPP BEYOND LIMITS
                        </div>
                    </footer>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

