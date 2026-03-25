'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Wifi, WifiOff, MessageSquare, BarChart3,
    RefreshCw, Send, Zap, Clock, CheckCircle2,
    XCircle, AlertCircle, Activity, Phone,
    Inbox, Users, ArrowRight, Server,
    Calendar, Loader2, QrCode, Settings,
    Trash2, ListFilter, Terminal, History,
    Search, Filter, Play, LogOut, RotateCcw,
    ChevronRight, ExternalLink, Hash, Bot,
    FileText, Radio, Contact
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Instance {
    instance: string;
    status: string;
    phone: string | null;
    nome?: string;
    avatar?: string | null;
}

interface DashboardStats {
    totalChats: number;
    totalChatbots: number;
    totalContacts: number;
    totalFlows: number;
    totalBroadcast: number;
    totalTemplets: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const s = status?.toLowerCase();
    const map: Record<string, { label: string; color: string; Icon: any }> = {
        connected: { label: 'Conectado', color: '#10b981', Icon: Wifi },
        open: { label: 'Conectado', color: '#10b981', Icon: Wifi },
        disconnected: { label: 'Desconectado', color: '#6b7280', Icon: WifiOff },
        created: { label: 'Criado', color: '#f59e0b', Icon: Clock },
        connecting: { label: 'Conectando...', color: '#3b82f6', Icon: Activity },
    };
    const cfg = map[s] || { label: status, color: '#6b7280', Icon: AlertCircle };
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{
            background: cfg.color + '10',
            color: cfg.color,
            borderColor: cfg.color + '20'
        }}>
            <cfg.Icon size={10} /> {cfg.label}
        </span>
    );
}

// ─── UI Components ────────────────────────────────────────────────────────────
function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <div
            className={`bg-white/[0.02] border border-white/[0.08] rounded-xl transition-all hover:border-white/[0.12] ${className}`}
            style={style}
        >
            {children}
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color, loading }: {
    icon: any; label: string; value: string | number; color: string; loading?: boolean;
}) {
    return (
        <Card className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '10' }}>
                <Icon size={18} style={{ color }} />
            </div>
            <div>
                <div className="text-xl font-black text-white tracking-tight">
                    {loading ? <Loader2 size={16} className="animate-spin text-white/20" /> : value}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</div>
            </div>
        </Card>
    );
}

// ─── Sub-Panels ───────────────────────────────────────────────────────────────

function InstanceIndicator({ instance }: { instance?: Instance }) {
    if (!instance) return null;
    const isConn = instance.status === 'connected' || instance.status === 'open';
    return (
        <div className="flex items-center gap-6 px-6 py-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl mb-8">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full animate-pulse ${isConn ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sessão:</span>
                <span className="text-sm font-black text-white">{instance.nome || instance.phone || 'Instância'}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
                <Hash size={14} className="text-slate-500" />
                <span className="text-sm font-mono text-slate-300">{instance.phone || 'Não vinculado'}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <StatusBadge status={instance.status} />
        </div>
    );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [instances, setInstances] = useState<Instance[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'instances'>('overview');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch instances using the proper Baileys API
            const [instResult, dashResult] = await Promise.allSettled([
                api.getWhatsAppInstances(),
                api.get('/api/user/get_dashboard'),
            ]);

            if (instResult.status === 'fulfilled') {
                setInstances(instResult.value.instances || []);
            }

            if (dashResult.status === 'fulfilled' && dashResult.value.success) {
                setStats({
                    totalChats: dashResult.value.totalChats || 0,
                    totalChatbots: dashResult.value.totalChatbots || 0,
                    totalContacts: dashResult.value.totalContacts || 0,
                    totalFlows: dashResult.value.totalFlows || 0,
                    totalBroadcast: dashResult.value.totalBroadcast || 0,
                    totalTemplets: dashResult.value.totalTemplets || 0,
                });
            }

            setLastRefresh(new Date());
        } catch (e) {
            console.error('[Dashboard] Load error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleInstanceAction = async (action: string, instanceId: string) => {
        try {
            if (action === 'connect') {
                const res = await api.getWhatsAppQr(instanceId);
                if (res.qr) {
                    window.dispatchEvent(new CustomEvent('show-qr-modal', { detail: { qr: res.qr, name: instanceId } }));
                } else if (res.status === 'connected') {
                    alert('Instância já conectada!');
                }
            } else if (action === 'disconnect') {
                await api.disconnectWhatsAppInstance(instanceId);
            } else if (action === 'delete') {
                if (confirm('Tem certeza que deseja deletar esta instância?')) {
                    await api.deleteWhatsAppInstance(instanceId);
                }
            }
            loadData();
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        }
    };

    const primaryInstance = instances.find(i => i.status === 'connected' || i.status === 'open') || instances[0];
    const connectedCount = instances.filter(i => i.status === 'connected' || i.status === 'open').length;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-8 font-sans selection:bg-brand-500/30">
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .custom-scroll::-webkit-scrollbar { width: 4px; }
                .custom-scroll::-webkit-scrollbar-track { background: transparent; }
                .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                        <Terminal size={24} className="text-brand-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            WhatsApp <span className="text-brand-500">Dashboard</span>
                        </h1>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                            <Activity size={12} className="text-brand-500" />
                            Baileys Direct Connection
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-600">
                        {lastRefresh.toLocaleTimeString('pt-BR')}
                    </span>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                        title="Atualizar dados"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="h-8 w-px bg-white/10 mx-2" />
                    <div className="flex items-center gap-3 pl-2">
                        <div className="text-right hidden sm:block">
                            <div className="text-[12px] font-black text-white leading-none">{user?.name || 'Carregando...'}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{user?.email}</div>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                            title="Sair"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Instance Indicator */}
            <InstanceIndicator instance={primaryInstance} />

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <StatCard icon={MessageSquare} label="Chats" value={stats?.totalChats || 0} color="#a78bfa" loading={loading} />
                <StatCard icon={Bot} label="Chatbots" value={stats?.totalChatbots || 0} color="#10b981" loading={loading} />
                <StatCard icon={Contact} label="Contatos" value={stats?.totalContacts || 0} color="#3b82f6" loading={loading} />
                <StatCard icon={Zap} label="Fluxos" value={stats?.totalFlows || 0} color="#f59e0b" loading={loading} />
                <StatCard icon={Send} label="Broadcasts" value={stats?.totalBroadcast || 0} color="#ec4899" loading={loading} />
                <StatCard icon={Server} label="Instâncias" value={`${connectedCount}/${instances.length}`} color="#64748b" loading={loading} />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-8 border-b border-white/5 mb-6 px-2">
                {[
                    { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
                    { id: 'instances', label: 'Instâncias WhatsApp', icon: Phone },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Quick Navigation */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Settings size={16} className="text-brand-500" />
                                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Acesso Rápido</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Link href="/inbox" className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                                            <Inbox size={18} className="text-brand-500" />
                                        </div>
                                        <div>
                                            <span className="text-[13px] font-bold text-white block">Central de Chats</span>
                                            <span className="text-[10px] text-slate-500">{stats?.totalChats || 0} conversas</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-all" />
                                </Link>

                                <Link href="/sessions" className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                            <QrCode size={18} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <span className="text-[13px] font-bold text-white block">Sessões WhatsApp</span>
                                            <span className="text-[10px] text-slate-500">{connectedCount} conectadas</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-all" />
                                </Link>

                                <Link href="/broadcast" className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                            <Radio size={18} className="text-pink-500" />
                                        </div>
                                        <div>
                                            <span className="text-[13px] font-bold text-white block">Broadcast</span>
                                            <span className="text-[10px] text-slate-500">{stats?.totalBroadcast || 0} campanhas</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-all" />
                                </Link>

                                <Link href="/chatbot" className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                            <Bot size={18} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <span className="text-[13px] font-bold text-white block">Chatbots</span>
                                            <span className="text-[10px] text-slate-500">{stats?.totalChatbots || 0} ativos</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-all" />
                                </Link>
                            </div>
                        </Card>

                        {/* Instances Quick View */}
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Phone size={16} className="text-brand-500" />
                                    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Instâncias WhatsApp</span>
                                </div>
                                <button
                                    onClick={() => setActiveTab('instances')}
                                    className="text-[10px] font-bold text-brand-500 hover:text-brand-400 uppercase tracking-wider"
                                >
                                    Ver todas →
                                </button>
                            </div>

                            {instances.length === 0 ? (
                                <div className="text-center py-8">
                                    <WifiOff size={32} className="text-slate-600 mx-auto mb-3" />
                                    <p className="text-[12px] text-slate-500 font-bold">Nenhuma instância configurada</p>
                                    <p className="text-[10px] text-slate-600 mt-1">Vá em Sessões WhatsApp para criar uma</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {instances.slice(0, 3).map(inst => (
                                        <div key={inst.instance} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${inst.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                                                <div>
                                                    <span className="text-[12px] font-bold text-white">{inst.nome || inst.phone || 'Instância'}</span>
                                                    <span className="text-[10px] text-slate-500 ml-2 font-mono">{inst.phone}</span>
                                                </div>
                                            </div>
                                            <StatusBadge status={inst.status} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Send Test Message */}
                        <SendTestPanel instances={instances} />

                        {/* System Info */}
                        <Card className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Server size={14} className="text-slate-500" />
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Sistema</span>
                            </div>
                            <div className="space-y-3 text-[11px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Backend</span>
                                    <span className="text-emerald-400 font-bold">Express + Baileys</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Banco de Dados</span>
                                    <span className="text-blue-400 font-bold">PostgreSQL 15</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Frontend</span>
                                    <span className="text-purple-400 font-bold">Next.js 14</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Real-time</span>
                                    <span className="text-amber-400 font-bold">Socket.io</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'instances' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {instances.length === 0 ? (
                        <div className="col-span-full text-center py-16">
                            <Phone size={48} className="text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-black text-white mb-2">Nenhuma instância</h3>
                            <p className="text-[12px] text-slate-500 mb-4">Crie uma nova sessão WhatsApp para começar</p>
                            <Link href="/sessions" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 text-brand-400 transition-all font-bold text-[12px] uppercase tracking-wider">
                                <QrCode size={14} />
                                Criar Sessão
                            </Link>
                        </div>
                    ) : instances.map(inst => (
                        <Card key={inst.instance} className="p-5 flex flex-col relative group">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 rounded-lg ${inst.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                    <Phone size={18} />
                                </div>
                                <StatusBadge status={inst.status} />
                            </div>
                            <div>
                                <h3 className="text-md font-black text-white">{inst.nome || inst.phone || 'Instância'}</h3>
                                <p className="text-[10px] font-mono text-slate-500 mt-1">{inst.phone || 'Nenhum número'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-6">
                                {inst.status !== 'connected' && (
                                    <button
                                        onClick={() => handleInstanceAction('connect', inst.instance)}
                                        className="py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase transition-all"
                                    >
                                        Conectar
                                    </button>
                                )}
                                {inst.status === 'connected' && (
                                    <button
                                        onClick={() => handleInstanceAction('disconnect', inst.instance)}
                                        className="py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase transition-all"
                                    >
                                        Reconectar
                                    </button>
                                )}
                                <button
                                    onClick={() => handleInstanceAction('delete', inst.instance)}
                                    className="py-2 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 text-red-400 text-[10px] font-bold uppercase transition-all"
                                >
                                    Deletar
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <QrModal />
        </div>
    );
}

// ─── Send Test Panel Component ──────────────────────────────────────────────
function SendTestPanel({ instances }: { instances: Instance[] }) {
    const [instance, setInstance] = useState('');
    const [to, setTo] = useState('');
    const [text, setText] = useState('Teste operacional ⚡');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        const connected = instances.find(i => i.status === 'connected');
        if (connected && !instance) {
            setInstance(connected.instance);
        }
    }, [instances, instance]);

    const handleSend = async () => {
        if (!instance || !to) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await api.sendWhatsAppText(instance, to, text);
            setResult({ ok: res?.success !== false, message: res?.msg || 'Enviado!' });
            if (res?.success !== false) setTimeout(() => setResult(null), 3000);
        } catch (err: any) {
            setResult({ ok: false, message: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="p-4 bg-brand-500/[0.01]">
            <div className="flex items-center gap-2 mb-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                <Send size={14} className="text-brand-500" />
                Envio Rápido
            </div>
            <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={instance} onChange={e => setInstance(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-brand-500/40 text-slate-300"
                    >
                        <option value="">Instância</option>
                        {instances.filter(i => i.status === 'connected').map(i => (
                            <option key={i.instance} value={i.instance}>{i.nome || i.phone || 'Sessão'}</option>
                        ))}
                    </select>
                    <input
                        value={to} onChange={e => setTo(e.target.value)}
                        placeholder="5511999..."
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-brand-500/40 text-slate-300"
                    />
                </div>
                <div className="flex gap-2">
                    <input
                        value={text} onChange={e => setText(e.target.value)}
                        placeholder="Mensagem"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-medium outline-none focus:border-brand-500/40 text-slate-300"
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !instance || !to}
                        className="px-4 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-30 transition-all text-white"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                </div>

                {result && (
                    <div className={`text-[9px] font-bold uppercase tracking-wider text-center p-1 rounded ${result.ok ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        {result.ok ? 'Sucesso' : result.message || 'Erro no envio'}
                    </div>
                )}
            </div>
        </Card>
    );
}

// ─── Modal para QR Code ──────────────────────────────────────────────────────
function QrModal() {
    const [data, setData] = useState<{ qr: string, name: string } | null>(null);

    useEffect(() => {
        const handler = (e: any) => setData(e.detail);
        window.addEventListener('show-qr-modal', handler);
        return () => window.removeEventListener('show-qr-modal', handler);
    }, []);

    if (!data) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-[#0f172a] border border-white/10 rounded-[32px] p-10 max-w-sm w-full text-center shadow-2xl relative animate-in scale-in-95 duration-300">
                <button onClick={() => setData(null)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors">
                    <XCircle size={24} />
                </button>
                <div className="mb-6 text-center">
                    <h2 className="text-xl font-black text-white px-8">Escanear QR Code</h2>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2">{data.name}</p>
                </div>
                <div className="bg-white p-6 rounded-[24px] inline-block mb-8 shadow-2xl">
                    <img src={data.qr} alt="QR Code" className="w-[180px] h-[180px]" />
                </div>
                <button
                    onClick={() => setData(null)}
                    className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] font-black uppercase tracking-widest py-3 rounded-xl transition-all"
                >
                    Fechar
                </button>
            </div>
        </div>
    );
}
