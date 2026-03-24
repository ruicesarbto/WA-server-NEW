'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    Wifi, WifiOff, MessageSquare, BarChart3,
    RefreshCw, Send, Zap, Clock, CheckCircle2,
    XCircle, AlertCircle, Activity, Phone,
    Inbox, Users, ArrowRight, Server,
    Calendar, Loader2, QrCode, Settings,
    Trash2, ListFilter, Terminal, History,
    Search, Filter, Play, LogOut, RotateCcw,
    ChevronRight, ExternalLink, Hash
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Instance {
    instance: string;
    status: string;
    phone: string | null;
    last_update?: string;
}

interface Stats {
    sent: number;
    received: number;
    failed: number;
    active_chats: number;
    pending_schedules: number;
}

interface Log {
    id: number;
    instance_name: string;
    recipient_phone: string;
    message_type: string;
    status: string;
    error: string | null;
    created_at: string;
}

interface WebhookLog {
    id: number;
    instance_name: string;
    event_type: string;
    payload: string;
    created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BASE = '/whatsapp-v3';

async function wFetch(path: string, opts?: RequestInit) {
    const endpoint = `${BASE}${path}`;
    const method = (opts?.method || 'GET').toUpperCase();

    try {
        if (method === 'POST') return await api.post(endpoint, opts?.body ? JSON.parse(opts.body as string) : {});
        if (method === 'PUT') return await api.put(endpoint, opts?.body ? JSON.parse(opts.body as string) : {});
        if (method === 'DELETE') return await api.delete(endpoint);
        return await api.get(endpoint);
    } catch (err: any) {
        console.error(`[WhatsAppConsole] Fetch error on ${path}:`, err);
        throw err;
    }
}

function formatJid(jid: string) {
    if (!jid) return '';
    if (jid.endsWith('@g.us')) return 'Grupo WhatsApp';
    if (jid.includes('@')) return 'Contato';
    return jid;
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; color: string; Icon: any }> = {
        connected: { label: 'Conectado', color: '#10b981', Icon: Wifi },
        open: { label: 'Conectado', color: '#10b981', Icon: Wifi },
        sent: { label: 'Enviado', color: '#10b981', Icon: CheckCircle2 },
        completed: { label: 'Concluído', color: '#10b981', Icon: CheckCircle2 },
        failed: { label: '⚠ Falha', color: '#f59e0b', Icon: AlertCircle },
        pending: { label: 'Pendente', color: '#f59e0b', Icon: Clock },
        disconnected: { label: 'Desconectado', color: '#6b7280', Icon: WifiOff },
    };
    const cfg = map[status] || { label: status, color: '#6b7280', Icon: AlertCircle };
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
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sessão Ativa:</span>
                <span className="text-sm font-black text-white">{instance.instance}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
                <Hash size={14} className="text-slate-500" />
                <span className="text-sm font-mono text-slate-300">{instance.phone || 'Não vinculado'}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 ml-auto">
                <Clock size={14} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-500 uppercase">Atividade:</span>
                <span className="text-[11px] font-mono text-slate-300">
                    {instance.last_update ? new Date(instance.last_update).toLocaleTimeString('pt-BR') : '--:--'}
                </span>
            </div>
        </div>
    );
}

// ─── Main Console Page ────────────────────────────────────────────────────────
export default function WhatsAppOperationsConsole() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [instances, setInstances] = useState<Instance[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'console' | 'instances' | 'webhooks'>('console');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    // Filters
    const [logStatus, setLogStatus] = useState('');
    const [logInstance, setLogInstance] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Focamos primeiro no que é essencial para renderizar a estrutura
            const [stRes, instRes] = await Promise.allSettled([
                wFetch('/messages/stats'),
                wFetch('/instances')
            ]);

            if (stRes.status === 'fulfilled') setStats(stRes.value.stats);
            if (instRes.status === 'fulfilled') setInstances(instRes.value.instances || []);

            // Já podemos liberar o loading principal para mostrar os cards
            setLoading(false);

            // Carregamos logs e webhooks em background, sem travar a UI
            Promise.allSettled([
                wFetch(`/messages/logs?limit=20${logStatus ? `&status=${logStatus}` : ''}${logInstance ? `&instance=${logInstance}` : ''}`),
                wFetch('/webhooks/logs?limit=30')
            ]).then(([lgRes, whRes]) => {
                if (lgRes.status === 'fulfilled') setLogs(lgRes.value.logs || []);
                if (whRes.status === 'fulfilled') setWebhookLogs(whRes.value.logs || []);
            });

            setLastRefresh(new Date());
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    }, [logStatus, logInstance]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAction = async (action: string, params: any = {}) => {
        try {
            if (action === 'sync_instances') {
                await wFetch('/instances', { method: 'POST', body: JSON.stringify({ action: 'sync' }) });
            } else if (action === 'delete_logs_recent') {
                await wFetch('/messages/logs', { method: 'DELETE' });
            } else if (action === 'delete_logs_today') {
                await wFetch('/messages/logs/today', { method: 'DELETE' });
            } else if (action === 'delete_logs_all') {
                if (confirm('Tem certeza que deseja apagar TODOS os logs de disparo?')) {
                    await wFetch('/messages/logs/all', { method: 'DELETE' });
                }
            } else if (action === 'connect') {
                const res = await wFetch(`/instances/${params.name}/connect`, { method: 'POST' });
                if (res.qr) {
                    window.dispatchEvent(new CustomEvent('show-qr-modal', { detail: { qr: res.qr, name: params.name } }));
                }
            } else if (action === 'disconnect') {
                await wFetch(`/instances/${params.name}/disconnect`, { method: 'POST' });
            } else if (action === 'reload') {
                await wFetch(`/instances/${params.name}/reload`, { method: 'POST' });
            }
            loadData();
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        }
    };

    const primaryInstance = instances.find(i => i.status === 'connected' || i.status === 'open') || instances[0];

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
                            WhatsApp <span className="text-brand-500">Operation Console</span>
                        </h1>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                            <Activity size={12} className="text-brand-500" />
                            Gestão Técnica WhatsApp API
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                        title="Sincronizar dados"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => handleAction('sync_instances')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 text-brand-400 transition-all font-bold text-[12px] uppercase tracking-wider"
                    >
                        <RotateCcw size={14} />
                        Cloud Sync
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <StatCard icon={Send} label="Enviadas" value={stats?.sent || 0} color="#10b981" loading={loading} />
                <StatCard icon={Inbox} label="Recebidas" value={stats?.received || 0} color="#3b82f6" loading={loading} />
                <StatCard icon={AlertCircle} label="Falhas" value={stats?.failed || 0} color="#f59e0b" loading={loading} />
                <StatCard icon={MessageSquare} label="Chats" value={stats?.active_chats || 0} color="#a78bfa" loading={loading} />
                <StatCard icon={Clock} label="Agenda" value={stats?.pending_schedules || 0} color="#64748b" loading={loading} />
            </div>

            {/* Main Content Areas */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Center / Left Content */}
                <div className="xl:col-span-12 space-y-6">

                    {/* Navigation Tabs (Professional Style) */}
                    <div className="flex items-center gap-8 border-b border-white/5 mb-2 px-2">
                        {[
                            { id: 'console', label: 'Console Principal', icon: Terminal },
                            { id: 'instances', label: 'Gestão de Instâncias', icon: Server },
                            { id: 'webhooks', label: 'Eventos Webhook', icon: Zap },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'console' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Operational Logs Table */}
                            <div className="lg:col-span-2">
                                <Card className="overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <History size={14} className="text-brand-500" />
                                            Histórico Recente (20)
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={logInstance} onChange={e => setLogInstance(e.target.value)}
                                                className="bg-transparent border-none text-[10px] font-black text-slate-500 uppercase tracking-wider outline-none cursor-pointer"
                                            >
                                                <option value="">Status</option>
                                                {instances.map(i => <option key={i.instance} value={i.instance}>{i.instance}</option>)}
                                            </select>
                                            <div className="h-3 w-px bg-white/10 mx-1" />
                                            <button onClick={() => handleAction('delete_logs_recent')} className="p-1 text-slate-600 hover:text-red-400 transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="max-height-[420px] overflow-y-auto custom-scroll" style={{ maxHeight: '420px' }}>
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-[#0f172a]/80 backdrop-blur-md z-10">
                                                <tr className="border-b border-white/5">
                                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Destino</th>
                                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                                                    <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Hora</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.04]">
                                                {logs.length === 0 ? (
                                                    <tr><td colSpan={4} className="py-20 text-center text-[11px] font-bold text-slate-600 uppercase">Nenhum registro</td></tr>
                                                ) : logs.map(log => (
                                                    <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                                                        <td className="px-6 py-3">
                                                            <div className="text-[12px] font-bold text-slate-300" title={log.recipient_phone}>
                                                                {formatJid(log.recipient_phone)}
                                                            </div>
                                                            <div className="text-[9px] text-slate-600 font-mono mt-0.5 uppercase tracking-tighter">
                                                                {log.instance_name}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <span className="text-[9px] font-black text-slate-500 bg-white/5 px-1.5 py-0.5 rounded uppercase border border-white/5">
                                                                {log.message_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <StatusBadge status={log.status} />
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            <div className="text-[11px] font-mono text-slate-500">{new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="p-3 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Filtros Avançados / Ações</span>
                                        <div className="flex gap-4">
                                            <button onClick={() => handleAction('delete_logs_today')} className="text-[9px] font-black text-slate-500 hover:text-orange-400 transition-all uppercase tracking-widest">Limpar Hoje</button>
                                            <button onClick={() => handleAction('delete_logs_all')} className="text-[9px] font-black text-slate-600 hover:text-red-500 transition-all uppercase tracking-widest">Hard Delete</button>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Sidebar Column: Send Test + Quick Commands */}
                            <div className="lg:col-span-1 space-y-6">
                                <SendTestPanelCompact instances={instances} />

                                <Card className="p-4 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Settings size={14} className="text-slate-500" />
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Gestão de Contexto</span>
                                    </div>
                                    <div className="space-y-2">
                                        <Link href="/inbox" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                                            <div className="flex items-center gap-3">
                                                <Inbox size={16} className="text-brand-500" />
                                                <span className="text-[12px] font-bold text-slate-300">Central de Chats</span>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-all" />
                                        </Link>
                                        <Link href="/sessions" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                                            <div className="flex items-center gap-3">
                                                <QrCode size={16} className="text-slate-500" />
                                                <span className="text-[12px] font-bold text-slate-300">Configuração Técnica</span>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-all" />
                                        </Link>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'instances' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {instances.map(inst => (
                                <Card key={inst.instance} className="p-5 flex flex-col relative group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2 rounded-lg ${inst.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                            <Phone size={18} />
                                        </div>
                                        <StatusBadge status={inst.status} />
                                    </div>
                                    <div>
                                        <h3 className="text-md font-black text-white">{inst.instance}</h3>
                                        <p className="text-[10px] font-mono text-slate-500 mt-1">{inst.phone || 'Nenhum número'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-6">
                                        <button
                                            onClick={() => handleAction('connect', { name: inst.instance })}
                                            className="py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold uppercase transition-all"
                                        >
                                            Conectar
                                        </button>
                                        <button
                                            onClick={() => handleAction('reload', { name: inst.instance })}
                                            className="py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold uppercase transition-all"
                                        >
                                            Reiniciar
                                        </button>
                                        <button
                                            onClick={() => handleAction('disconnect', { name: inst.instance })}
                                            className="col-span-2 py-2 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 text-red-400 text-[10px] font-bold uppercase transition-all"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {activeTab === 'webhooks' && (
                        <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <Zap size={14} className="text-brand-500" />
                                Real-time Webhook Stream
                            </div>
                            <div className="overflow-x-auto max-h-[500px] custom-scroll">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-[#0f172a] border-b border-white/5">
                                        <tr>
                                            <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Instância</th>
                                            <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Evento</th>
                                            <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Hora</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {webhookLogs.map(wh => (
                                            <tr key={wh.id} className="hover:bg-white/[0.01] transition-colors">
                                                <td className="px-6 py-3 text-[12px] font-bold text-slate-300">{wh.instance_name}</td>
                                                <td className="px-6 py-3">
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-brand-500/10 text-brand-500 border border-brand-500/20">
                                                        {wh.event_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono text-[10px] text-slate-500">
                                                    {new Date(wh.created_at).toLocaleTimeString('pt-BR')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            <QrModal />
        </div>
    );
}

// ─── Send Test Panel Component (COMPACT) ──────────────────────────────────────
function SendTestPanelCompact({ instances }: { instances: Instance[] }) {
    const [instance, setInstance] = useState('');
    const [to, setTo] = useState('');
    const [text, setText] = useState('Teste operacional ⚡');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        if (instances.length === 1 && !instance) {
            setInstance(instances[0].instance);
        }
    }, [instances, instance]);

    const handleSend = async () => {
        if (!instance || !to) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await wFetch('/messages/send-text', {
                method: 'POST',
                body: JSON.stringify({ instance, to, text })
            });
            setResult(res);
            if (res.ok) setTimeout(() => setResult(null), 3000);
        } catch (err: any) {
            setResult({ ok: false, error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="p-4 bg-brand-500/[0.01]">
            <div className="flex items-center gap-2 mb-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                <Send size={14} className="text-brand-500" />
                Disparo Rápido (Async)
            </div>
            <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={instance} onChange={e => setInstance(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-brand-500/40 text-slate-300"
                    >
                        <option value="">Origem</option>
                        {instances.map(i => <option key={i.instance} value={i.instance}>{i.instance}</option>)}
                    </select>
                    <input
                        value={to} onChange={e => setTo(e.target.value)}
                        placeholder="55129..."
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-brand-500/40 text-slate-300"
                    />
                </div>
                <div className="flex gap-2">
                    <input
                        value={text} onChange={e => setText(e.target.value)}
                        placeholder="Conteúdo"
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
                    <div className={`text-[9px] font-bold uppercase tracking-wider text-center p-1 rounded ${result.ok ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                        }`}>
                        {result.ok ? 'Sucesso' : 'Erro no envio'}
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
                    <h2 className="text-xl font-black text-white px-8">Pairing Protocol</h2>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2">{data.name}</p>
                </div>
                <div className="bg-white p-6 rounded-[24px] inline-block mb-8 shadow-2xl">
                    <img src={data.qr} alt="QR Code" className="w-[180px] h-[180px]" />
                </div>
                <button
                    onClick={() => setData(null)}
                    className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] font-black uppercase tracking-widest py-3 rounded-xl transition-all"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}
