'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    BrainCircuit, Plus, Trash2, Pencil, ChevronDown, Check, X,
    Eye, EyeOff, AlertCircle, RefreshCw, Bot, Key, Settings,
    Zap, MessageSquare, Clock, Hash, StopCircle, Loader2,
    ToggleLeft, ToggleRight, Save, ArrowLeft, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Instance {
    id: string;
    nome: string;
    phone: string | null;
    status?: string;
}

interface AICred {
    id: string;
    name: string;
    apiKey?: string; // masked by API
}

interface AIBot {
    id: string;
    openaiCredsId: string;
    model: string;
    systemMessages: string[];
    maxTokens: number;
    expire: number;
    keywordFinish: string;
    delayMessage: number;
    unknownMessage: string;
    listeningFromMe: boolean;
    stopBotFromMe: boolean;
    keepOpen: boolean;
    debounceTime: number;
    triggerType: 'all' | 'keyword' | 'none';
    triggerOperator?: string;
    triggerValue?: string;
    enabled?: boolean;
}

const MODELS = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido, barato)' },
    { value: 'gpt-4o', label: 'GPT-4o (melhor qualidade)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (legado)' },
];

const emptyBot = (): Partial<AIBot> => ({
    model: 'gpt-4o-mini',
    systemMessages: [''],
    maxTokens: 300,
    expire: 20,
    keywordFinish: '#sair',
    delayMessage: 1000,
    unknownMessage: 'Não entendi. Digite #sair para falar com um atendente.',
    listeningFromMe: false,
    stopBotFromMe: true,
    keepOpen: false,
    debounceTime: 10,
    triggerType: 'all',
    triggerOperator: 'contains',
    triggerValue: '',
});

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600">
                    {icon}
                </div>
                <h2 className="text-base font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!value)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${value ? 'bg-violet-600' : 'bg-gray-200'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WhatsAppBotsPage() {
    const [instances, setInstances] = useState<Instance[]>([]);
    const [activeInstance, setActiveInstance] = useState<Instance | null>(null);
    const [instanceDropdownOpen, setInstanceDropdownOpen] = useState(false);
    const [loadingInstances, setLoadingInstances] = useState(true);

    // Credentials
    const [creds, setCreds] = useState<AICred[]>([]);
    const [loadingCreds, setLoadingCreds] = useState(false);
    const [showCredForm, setShowCredForm] = useState(false);
    const [credName, setCredName] = useState('');
    const [credApiKey, setCredApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [savingCred, setSavingCred] = useState(false);
    const [deletingCredId, setDeletingCredId] = useState<string | null>(null);

    // Bots
    const [bots, setBots] = useState<AIBot[]>([]);
    const [loadingBots, setLoadingBots] = useState(false);
    const [editingBot, setEditingBot] = useState<Partial<AIBot> | null>(null);
    const [editingBotId, setEditingBotId] = useState<string | null>(null); // null = new
    const [savingBot, setSavingBot] = useState(false);
    const [deletingBotId, setDeletingBotId] = useState<string | null>(null);

    // Feedback
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Load instances
    useEffect(() => {
        api.getConnectedInstances?.().then((data: any) => {
            const instList = data?.instances || data || [];
            if (Array.isArray(instList)) {
                setInstances(instList);
                if (instList.length) setActiveInstance(instList[0]);
            }
        }).catch(() => {}).finally(() => setLoadingInstances(false));
    }, []);

    const loadCreds = useCallback(async (instanceId: string) => {
        setLoadingCreds(true);
        try {
            const data = await api.getAICredentials(instanceId);
            setCreds(Array.isArray(data) ? data : []);
        } catch { setCreds([]); }
        finally { setLoadingCreds(false); }
    }, []);

    const loadBots = useCallback(async (instanceId: string) => {
        setLoadingBots(true);
        try {
            const data = await api.getAIBots(instanceId);
            setBots(Array.isArray(data) ? data : []);
        } catch { setBots([]); }
        finally { setLoadingBots(false); }
    }, []);

    useEffect(() => {
        if (!activeInstance) return;
        loadCreds(activeInstance.id);
        loadBots(activeInstance.id);
        setEditingBot(null);
        setEditingBotId(null);
        setShowCredForm(false);
    }, [activeInstance, loadCreds, loadBots]);

    // ─ Credential actions ─────────────────────────────────────────────────────

    const handleSaveCred = async () => {
        if (!activeInstance || !credName.trim() || !credApiKey.trim()) return;
        setSavingCred(true);
        try {
            await api.createAICredential(activeInstance.id, credName.trim(), credApiKey.trim());
            showToast('Credencial salva!');
            setCredName(''); setCredApiKey(''); setShowCredForm(false);
            loadCreds(activeInstance.id);
        } catch (err: any) { showToast(err.message || 'Erro ao salvar credencial', 'err'); }
        finally { setSavingCred(false); }
    };

    const handleDeleteCred = async (credId: string) => {
        if (!activeInstance || !confirm('Deletar esta credencial? Os bots que a usam serão desativados.')) return;
        setDeletingCredId(credId);
        try {
            await api.deleteAICredential(activeInstance.id, credId);
            showToast('Credencial removida');
            loadCreds(activeInstance.id);
            loadBots(activeInstance.id);
        } catch (err: any) { showToast(err.message || 'Erro ao deletar', 'err'); }
        finally { setDeletingCredId(null); }
    };

    // ─ Bot actions ────────────────────────────────────────────────────────────

    const openNewBot = () => {
        setEditingBotId(null);
        setEditingBot(emptyBot());
    };

    const openEditBot = async (bot: AIBot) => {
        setEditingBotId(bot.id);
        setEditingBot({
            ...bot,
            systemMessages: bot.systemMessages?.length ? bot.systemMessages : [''],
        });
    };

    const handleSaveBot = async () => {
        if (!activeInstance || !editingBot) return;
        if (!editingBot.openaiCredsId) { showToast('Selecione uma credencial OpenAI', 'err'); return; }
        if (!editingBot.systemMessages?.[0]?.trim()) { showToast('O System Prompt é obrigatório', 'err'); return; }

        setSavingBot(true);
        const payload = {
            ...editingBot,
            systemMessages: (editingBot.systemMessages || []).filter(Boolean),
            assistantMessages: [],
            userMessages: [],
        };
        try {
            if (editingBotId) {
                await api.updateAIBot(activeInstance.id, editingBotId, payload as Record<string, unknown>);
                showToast('Bot atualizado!');
            } else {
                await api.createAIBot(activeInstance.id, payload as Record<string, unknown>);
                showToast('Bot criado!');
            }
            setEditingBot(null);
            setEditingBotId(null);
            loadBots(activeInstance.id);
        } catch (err: any) { showToast(err.message || 'Erro ao salvar bot', 'err'); }
        finally { setSavingBot(false); }
    };

    const handleDeleteBot = async (botId: string) => {
        if (!activeInstance || !confirm('Deletar este bot?')) return;
        setDeletingBotId(botId);
        try {
            await api.deleteAIBot(activeInstance.id, botId);
            showToast('Bot removido');
            loadBots(activeInstance.id);
        } catch (err: any) { showToast(err.message || 'Erro ao deletar', 'err'); }
        finally { setDeletingBotId(null); }
    };

    const patchBot = (patch: Partial<AIBot>) => setEditingBot(prev => prev ? { ...prev, ...patch } : prev);

    // ─ Render ─────────────────────────────────────────────────────────────────

    if (loadingInstances) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className={`fixed top-6 right-6 z-[300] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-semibold ${toast.type === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}
                    >
                        {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/admin/whatsapp" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
                        <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Bot IA</h1>
                        <p className="text-sm text-gray-400">Configuração OpenAI para WhatsApp</p>
                    </div>
                </div>

                {/* Instance selector */}
                <div className="relative">
                    <button
                        onClick={() => setInstanceDropdownOpen(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-violet-300 transition-colors shadow-sm"
                    >
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        {activeInstance?.nome || 'Selecionar instância'}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${instanceDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {instanceDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50"
                            >
                                {instances.map(inst => (
                                    <button key={inst.id} onClick={() => { setActiveInstance(inst); setInstanceDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${activeInstance?.id === inst.id ? 'text-violet-600 font-semibold' : 'text-gray-700'}`}
                                    >
                                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                                        <span className="truncate">{inst.nome}</span>
                                        {activeInstance?.id === inst.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {!activeInstance ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-4">
                    <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                    <p className="text-amber-700 text-sm">Nenhuma instância WhatsApp conectada. <Link href="/admin/whatsapp/sessions" className="underline font-semibold">Conectar agora →</Link></p>
                </div>
            ) : (
                <>
                    {/* ── Seção 1: Credenciais OpenAI ──────────────────────────────────── */}
                    <SectionCard title="Credenciais OpenAI" icon={<Key className="w-4 h-4" />}>
                        <div className="space-y-3">
                            {loadingCreds ? (
                                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                </div>
                            ) : creds.length === 0 && !showCredForm ? (
                                <div className="text-sm text-gray-400 py-2">Nenhuma credencial cadastrada.</div>
                            ) : (
                                creds.map(cred => (
                                    <div key={cred.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                                                <Key className="w-4 h-4 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{cred.name}</p>
                                                <p className="text-xs text-gray-400 font-mono">sk-••••••••••••••••</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteCred(cred.id)}
                                            disabled={deletingCredId === cred.id}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {deletingCredId === cred.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ))
                            )}

                            {/* Add credential form */}
                            <AnimatePresence>
                                {showCredForm && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border border-violet-200 bg-violet-50/30 rounded-xl p-4 space-y-3"
                                    >
                                        <input
                                            type="text"
                                            placeholder="Nome da credencial (ex: Minha OpenAI)"
                                            value={credName}
                                            onChange={e => setCredName(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type={showApiKey ? 'text' : 'password'}
                                                placeholder="sk-... (API Key da OpenAI)"
                                                value={credApiKey}
                                                onChange={e => setCredApiKey(e.target.value)}
                                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                            />
                                            <button onClick={() => setShowApiKey(v => !v)} className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-lg transition-colors">
                                                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveCred}
                                                disabled={savingCred || !credName.trim() || !credApiKey.trim()}
                                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                            >
                                                {savingCred ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                Salvar
                                            </button>
                                            <button onClick={() => { setShowCredForm(false); setCredName(''); setCredApiKey(''); }} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                                                Cancelar
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {!showCredForm && (
                                <button
                                    onClick={() => setShowCredForm(true)}
                                    className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-semibold mt-1 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar credencial
                                </button>
                            )}
                        </div>
                    </SectionCard>

                    {/* ── Seção 2: Bots ─────────────────────────────────────────────────── */}
                    <SectionCard title="Bots Configurados" icon={<Bot className="w-4 h-4" />}>
                        <div className="space-y-3">
                            {loadingBots ? (
                                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                </div>
                            ) : bots.length === 0 && !editingBot ? (
                                <div className="text-sm text-gray-400 py-2">Nenhum bot configurado para esta instância.</div>
                            ) : (
                                bots.map(bot => {
                                    const cred = creds.find(c => c.id === bot.openaiCredsId);
                                    return (
                                        <div key={bot.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl gap-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                                    <BrainCircuit className="w-4 h-4 text-violet-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-semibold text-gray-800">{bot.model}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bot.enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                                            {bot.enabled !== false ? '● Ativo' : '○ Pausado'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                                                            {bot.triggerType === 'all' ? 'Todos os chats' : bot.triggerType === 'keyword' ? `Keyword: ${bot.triggerValue}` : 'Desativado'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                                                        {bot.systemMessages?.[0]?.slice(0, 80) || 'Sem system prompt'}
                                                        {(bot.systemMessages?.[0]?.length || 0) > 80 ? '…' : ''}
                                                    </p>
                                                    {cred && <p className="text-[11px] text-violet-500 mt-0.5">🔑 {cred.name}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => openEditBot(bot)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteBot(bot.id)} disabled={deletingBotId === bot.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                                                    {deletingBotId === bot.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {!editingBot && (
                                <button
                                    onClick={openNewBot}
                                    disabled={creds.length === 0}
                                    title={creds.length === 0 ? 'Adicione uma credencial OpenAI primeiro' : undefined}
                                    className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-semibold mt-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4" /> Criar bot
                                </button>
                            )}
                        </div>
                    </SectionCard>

                    {/* ── Seção 3: Formulário de Bot ────────────────────────────────────── */}
                    <AnimatePresence>
                        {editingBot && (
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 16 }}
                            >
                                <SectionCard
                                    title={editingBotId ? 'Editar Bot' : 'Novo Bot'}
                                    icon={<Settings className="w-4 h-4" />}
                                >
                                    <div className="space-y-6">

                                        {/* Credencial */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                                Credencial OpenAI <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                                value={editingBot.openaiCredsId || ''}
                                                onChange={e => patchBot({ openaiCredsId: e.target.value })}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                            >
                                                <option value="">Selecionar credencial...</option>
                                                {creds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>

                                        {/* Modelo */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                                Modelo
                                            </label>
                                            <select
                                                value={editingBot.model || 'gpt-4o-mini'}
                                                onChange={e => patchBot({ model: e.target.value })}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                            >
                                                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                            </select>
                                        </div>

                                        {/* System Prompt — o "treinamento" */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                    System Prompt (treinamento) <span className="text-red-400">*</span>
                                                </label>
                                                <span className="text-[11px] text-gray-400">
                                                    {editingBot.systemMessages?.[0]?.length || 0} chars
                                                </span>
                                            </div>
                                            <div className="bg-violet-50/40 border border-violet-200 rounded-xl p-1">
                                                <textarea
                                                    rows={10}
                                                    placeholder={`Você é o assistente virtual do Clube 67, um clube de benefícios exclusivo. Seu nome é "Bia".

SOBRE O CLUBE:
- Membros têm acesso a descontos em parceiros selecionados
- Para ver benefícios: acesse clube67.com/beneficios

SEU COMPORTAMENTO:
- Responda sempre em português, de forma amigável e objetiva
- Se não souber, diga: "Vou verificar e te retorno em breve"
- Máximo 3 parágrafos por resposta

TRANSFERIR PARA HUMANO quando o usuário digitar "${editingBot.keywordFinish || '#sair'}"`}
                                                    value={editingBot.systemMessages?.[0] || ''}
                                                    onChange={e => patchBot({ systemMessages: [e.target.value] })}
                                                    className="w-full bg-transparent px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none leading-relaxed"
                                                />
                                            </div>
                                            <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                                                <Info className="w-3 h-3" />
                                                Este texto define toda a personalidade e conhecimento do bot.
                                            </p>
                                        </div>

                                        {/* Trigger */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                                <Zap className="w-3 h-3 inline mr-1" /> Ativar bot para
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { value: 'all', label: 'Todos os chats', desc: 'Responde a qualquer mensagem' },
                                                    { value: 'keyword', label: 'Keyword', desc: 'Só quando uma palavra específica é enviada' },
                                                    { value: 'none', label: 'Nenhum', desc: 'Bot desativado' },
                                                ].map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => patchBot({ triggerType: opt.value as AIBot['triggerType'] })}
                                                        className={`p-3 rounded-xl border text-left transition-all ${editingBot.triggerType === opt.value ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                                                    >
                                                        <p className="text-xs font-bold">{opt.label}</p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                            {editingBot.triggerType === 'keyword' && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Palavra-chave (ex: oi, ajuda, suporte)"
                                                        value={editingBot.triggerValue || ''}
                                                        onChange={e => patchBot({ triggerValue: e.target.value })}
                                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Comportamento — grade de toggles + numbers */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                                                Comportamento
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                                {/* Stop bot from me */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Parar quando eu responder</p>
                                                        <p className="text-[11px] text-gray-400">Bot pausa ao atendente responder</p>
                                                    </div>
                                                    <Toggle value={!!editingBot.stopBotFromMe} onChange={v => patchBot({ stopBotFromMe: v })} />
                                                </div>

                                                {/* Listening from me */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Escutar minhas msgs</p>
                                                        <p className="text-[11px] text-gray-400">Processar msgs enviadas por mim</p>
                                                    </div>
                                                    <Toggle value={!!editingBot.listeningFromMe} onChange={v => patchBot({ listeningFromMe: v })} />
                                                </div>

                                                {/* Keep open */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Manter sessão aberta</p>
                                                        <p className="text-[11px] text-gray-400">Não expira por inatividade</p>
                                                    </div>
                                                    <Toggle value={!!editingBot.keepOpen} onChange={v => patchBot({ keepOpen: v })} />
                                                </div>

                                                {/* Expire */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5" /> Expirar sessão
                                                        </p>
                                                        <p className="text-[11px] text-gray-400">Minutos de inatividade</p>
                                                    </div>
                                                    <input
                                                        type="number" min={1} max={1440}
                                                        value={editingBot.expire ?? 20}
                                                        onChange={e => patchBot({ expire: Number(e.target.value) })}
                                                        className="w-16 text-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                    />
                                                </div>

                                                {/* Max tokens */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Max tokens</p>
                                                        <p className="text-[11px] text-gray-400">Tamanho máximo da resposta</p>
                                                    </div>
                                                    <input
                                                        type="number" min={50} max={4096} step={50}
                                                        value={editingBot.maxTokens ?? 300}
                                                        onChange={e => patchBot({ maxTokens: Number(e.target.value) })}
                                                        className="w-20 text-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                    />
                                                </div>

                                                {/* Delay message */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Delay de resposta (ms)</p>
                                                        <p className="text-[11px] text-gray-400">Simula digitação humana</p>
                                                    </div>
                                                    <input
                                                        type="number" min={0} max={10000} step={500}
                                                        value={editingBot.delayMessage ?? 1000}
                                                        onChange={e => patchBot({ delayMessage: Number(e.target.value) })}
                                                        className="w-20 text-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Keyword e mensagens de controle */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                                    <Hash className="w-3 h-3 inline mr-1" /> Palavra para encerrar
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editingBot.keywordFinish || ''}
                                                    onChange={e => patchBot({ keywordFinish: e.target.value })}
                                                    placeholder="#sair"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                />
                                                <p className="text-[11px] text-gray-400 mt-1">Usuário digita isso para falar com humano</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                                    <MessageSquare className="w-3 h-3 inline mr-1" /> Mensagem quando não entende
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editingBot.unknownMessage || ''}
                                                    onChange={e => patchBot({ unknownMessage: e.target.value })}
                                                    placeholder="Não entendi. Digite #sair para falar com um atendente."
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                />
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                            <button
                                                onClick={() => { setEditingBot(null); setEditingBotId(null); }}
                                                className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSaveBot}
                                                disabled={savingBot || !editingBot.openaiCredsId || !editingBot.systemMessages?.[0]?.trim()}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
                                            >
                                                {savingBot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                {editingBotId ? 'Salvar alterações' : 'Criar bot'}
                                            </button>
                                        </div>
                                    </div>
                                </SectionCard>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
