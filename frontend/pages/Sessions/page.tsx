'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, Plus, Wifi, WifiOff, RefreshCw, LogOut, Trash2, QrCode, X,
    AlertCircle, CheckCircle2, Loader2, Save, Activity, Database, Globe,
    User, Camera, AlertTriangle, MessageSquare, Image, ServerCrash,
    ShieldAlert, Zap, ChevronRight, ArrowLeft
} from 'lucide-react';
import { whatsappService } from '../../services/whatsappService';
import { useWhatsAppStore, startInstancePolling, stopInstancePolling } from '../Inbox/whatsappStore';
import { WhatsAppInstance as Instance, PurgeMode, PurgeStep, StepStatus } from '../Inbox/types';
import { getAvatarProxyUrl, getAvatarColor, getAvatarInitials } from '../Inbox/utils';
import { chatEngine } from '../../core/chatEngine';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';


// ─── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({
    instance,
    onClose,
    onDone,
}: {
    instance: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const [phase, setPhase] = useState<'select' | 'progress' | 'done'>('select');
    const [mode, setMode] = useState<PurgeMode>('all');
    const [steps, setSteps] = useState<PurgeStep[]>([]);
    const [summary, setSummary] = useState<{ ok: boolean; message: string } | null>(null);

    const STEP_META: Record<string, { label: string; icon: React.ReactNode }> = {
        whatsapp_delete: { label: 'WhatsApp API', icon: <Zap size={16} /> },
        database: { label: 'Banco de Dados', icon: <Database size={16} /> },
        wasabi: { label: 'Mídias (Wasabi)', icon: <Image size={16} /> },
        baileys_auth: { label: 'Auth Baileys', icon: <ShieldAlert size={16} /> },
        session_reload: { label: 'Reload da Sessão', icon: <RefreshCw size={16} /> },
    };

    const initSteps = useCallback((m: PurgeMode): PurgeStep[] => {
        return [
            { id: 'baileys_logout', label: 'Conexão WhatsApp', detail: 'Encerrando sessão e invalidando chaves...', icon: <WifiOff size={16} />, status: 'waiting' },
            { id: 'baileys_auth', label: 'Credenciais de Auth', detail: 'Apagando chaves de autenticação do PG...', icon: <ShieldAlert size={16} />, status: 'waiting' },
            { id: 'database', label: 'Banco de Dados', detail: 'Limpando histórico de chats e mensagens...', icon: <Database size={16} />, status: 'waiting' },
            { id: 'redis_cache', label: 'Cache Redis', detail: 'Limpando Inbox e Cache de Mensagens...', icon: <Activity size={16} />, status: 'waiting' },
            { id: 'disk_media', label: 'Arquivos de Mídia', detail: 'Removendo mídias do disco...', icon: <Image size={16} />, status: 'waiting' },
        ];
    }, []);

    const runPurge = useCallback(async (selectedMode: PurgeMode) => {
        setMode(selectedMode);
        const initialSteps = initSteps(selectedMode);
        setSteps(initialSteps);
        setPhase('progress');

        // Animate each step as "running" sequentially for UX
        // Then call the API once (it handles everything server-side)
        const activeIds = initialSteps.filter((s: PurgeStep) => s.status !== 'skip').map((s: PurgeStep) => s.id);

        // Simulate incremental progress
        for (let i = 0; i < activeIds.length; i++) {
            setSteps((prev: PurgeStep[]) => prev.map((s: PurgeStep) =>
                s.id === activeIds[i] ? { ...s, status: 'running' } : s
            ));
            await new Promise(r => setTimeout(r, 600)); // visual delay per step
        }

        // Call the actual API
        try {
            const data = await whatsappService.deleteInstance(instance, selectedMode);

            setSteps(initialSteps.map((s: PurgeStep) => ({
                ...s,
                status: data.ok ? 'ok' : 'error',
                detail: data.ok ? 'Removido com sucesso.' : 'Falha na remoção.',
            })));


            setSummary({
                ok: data.ok,
                message: data.ok ? 'Operação concluída com sucesso!' : 'Concluído com alguns erros.',
            });
        } catch (err: any) {
            setSteps((prev: PurgeStep[]) => prev.map((s: PurgeStep) => s.status === 'running' ? { ...s, status: 'error', detail: err.message } : s));
            setSummary({ ok: false, message: 'Erro de conexão: ' + err.message });
        }

        setPhase('done');
    }, [instance, initSteps]);

    const statusColor: Record<StepStatus, string> = {
        waiting: '#475569',
        running: '#3b82f6',
        ok: '#10b981',
        error: '#ef4444',
        skip: '#94a3b8',
    };

    const statusIcon: Record<StepStatus, React.ReactNode> = {
        waiting: <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #475569' }} />,
        running: <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />,
        ok: <CheckCircle2 size={18} style={{ color: '#10b981' }} />,
        error: <AlertCircle size={18} style={{ color: '#ef4444' }} />,
        skip: <ChevronRight size={18} style={{ color: '#94a3b8' }} />,
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={phase === 'done' ? onClose : undefined}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', cursor: phase === 'done' ? 'pointer' : 'default' }}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                style={{
                    position: 'relative', width: '100%', maxWidth: 480,
                    background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 28,
                    overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
                }}
            >
                {/* Red accent top bar */}
                <div style={{ height: 3, background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)' }} />

                <div style={{ padding: '28px 28px 24px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Trash2 size={20} style={{ color: '#ef4444' }} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                                    Apagar Sessão
                                </h2>
                                <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                    <code style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 5 }}>
                                        {instance}
                                    </code>
                                </p>
                            </div>
                        </div>
                        {phase !== 'progress' && (
                            <button onClick={onClose} style={{
                                width: 32, height: 32, borderRadius: 8, border: 'none',
                                background: 'rgba(255,255,255,0.06)', color: '#64748b',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* PHASE: SELECT */}
                    <AnimatePresence mode="wait">
                        {phase === 'select' && (
                            <motion.div
                                key="select"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                                    Escolha o que deseja apagar para a instância <strong style={{ color: '#e2e8f0' }}>{instance}</strong>. Esta ação é <strong style={{ color: '#ef4444' }}>irreversível</strong>.
                                </p>

                                {/* Option cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                                    {/* Apagar Mensagens e Mídias */}
                                    <button
                                        onClick={() => runPurge('data_only')}
                                        style={{
                                            padding: '16px 18px', borderRadius: 14, border: '1px solid rgba(251,191,36,0.25)',
                                            background: 'rgba(251,191,36,0.06)', cursor: 'pointer', textAlign: 'left',
                                            display: 'flex', alignItems: 'center', gap: 14, transition: 'all .15s',
                                        }}
                                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.12)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.5)'; }}
                                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.25)'; }}
                                    >
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                            background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <MessageSquare size={18} style={{ color: '#fbbf24' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24', marginBottom: 3 }}>
                                                Apagar Mensagens e Mídias
                                            </div>
                                            <div style={{ fontSize: 12, color: '#78716c', lineHeight: 1.5 }}>
                                                Remove chats, mensagens e arquivos do Wasabi. Mantém a sessão ativa.
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                                {['DB: Msgs & Chats', 'Wasabi: Mídias'].map(t => (
                                                    <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(251,191,36,0.1)', color: '#92400e', fontWeight: 600 }}>{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} style={{ color: '#475569', flexShrink: 0 }} />
                                    </button>

                                    {/* Apagar Tudo */}
                                    <button
                                        onClick={() => runPurge('all')}
                                        style={{
                                            padding: '16px 18px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.25)',
                                            background: 'rgba(239,68,68,0.06)', cursor: 'pointer', textAlign: 'left',
                                            display: 'flex', alignItems: 'center', gap: 14, transition: 'all .15s',
                                        }}
                                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.5)'; }}
                                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.25)'; }}
                                    >
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <ServerCrash size={18} style={{ color: '#ef4444' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', marginBottom: 3 }}>
                                                Apagar Tudo
                                            </div>
                                            <div style={{ fontSize: 12, color: '#78716c', lineHeight: 1.5 }}>
                                                Reset completo. Remove a instância da WhatsApp API, banco, mídias e auth Baileys.
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                                {['WhatsApp API', 'DB', 'Wasabi', 'Baileys Auth'].map(t => (
                                                    <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#b91c1c', fontWeight: 600 }}>{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} style={{ color: '#475569', flexShrink: 0 }} />
                                    </button>
                                </div>

                                <button onClick={onClose} style={{
                                    width: '100%', padding: '12px', background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                                    color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all .15s',
                                }}
                                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                                >
                                    Cancelar
                                </button>
                            </motion.div>
                        )}

                        {/* PHASE: PROGRESS */}
                        {phase === 'progress' && (
                            <motion.div
                                key="progress"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
                                        Executando operações...
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                                        <motion.div
                                            style={{ height: '100%', background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius: 10 }}
                                            animate={{ width: `${(steps.filter((s: PurgeStep) => s.status === 'ok' || s.status === 'skip').length / Math.max(steps.length, 1)) * 100}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>

                                    {/* Step list */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {steps.map((step: PurgeStep, idx: number) => (
                                            <motion.div
                                                key={step.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                    padding: '12px 14px', borderRadius: 12,
                                                    background: step.status === 'skip'
                                                        ? 'rgba(255,255,255,0.02)'
                                                        : step.status === 'running'
                                                            ? 'rgba(59,130,246,0.08)'
                                                            : step.status === 'ok'
                                                                ? 'rgba(16,185,129,0.08)'
                                                                : step.status === 'error'
                                                                    ? 'rgba(239,68,68,0.08)'
                                                                    : 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${statusColor[step.status]}22`,
                                                    transition: 'all .3s',
                                                }}
                                            >
                                                <div style={{ flexShrink: 0 }}>{statusIcon[step.status]}</div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: step.status === 'skip' ? '#475569' : '#e2e8f0' }}>
                                                        {step.label}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: statusColor[step.status], marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {step.detail}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                                    background: `${statusColor[step.status]}22`, color: statusColor[step.status],
                                                    textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
                                                }}>
                                                    {step.status}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* PHASE: DONE */}
                        {phase === 'done' && (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                {/* Result summary */}
                                <div style={{
                                    padding: '14px 16px', borderRadius: 12, marginBottom: 20,
                                    background: summary?.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${summary?.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    display: 'flex', alignItems: 'center', gap: 10,
                                }}>
                                    {summary?.ok
                                        ? <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                                        : <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                                    }
                                    <span style={{ fontSize: 14, fontWeight: 600, color: summary?.ok ? '#6ee7b7' : '#fca5a5' }}>
                                        {summary?.message}
                                    </span>
                                </div>

                                {/* Step recap */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                                    {steps.map((step: PurgeStep) => (
                                        <div key={step.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 12px', borderRadius: 10,
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                        }}>
                                            <div style={{ flexShrink: 0 }}>{statusIcon[step.status]}</div>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{step.label}</span>
                                                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>— {step.detail}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={onClose} style={{
                                        flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                                        color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                                    }}>
                                        Fechar
                                    </button>
                                    <button onClick={() => { onDone(); onClose(); }} style={{
                                        flex: 1, padding: '12px',
                                        background: 'linear-gradient(135deg,#10b981,#059669)',
                                        border: 'none', borderRadius: 12,
                                        color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                                    }}>
                                        Atualizar Lista
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Error Logs Modal ──────────────────────────────────────────────────────────
interface ErrorLogEntry {
    id: number;
    created_at: string;
    recipient_phone: string;
    message_type: string;
    error: string;
}

function ErrorLogsModal({ instance, onClose }: { instance: string; onClose: () => void }) {
    const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        whatsappService.getInstanceErrors(instance, 50)
            .then((res: any) => { if (res.ok && Array.isArray(res.errors)) setErrors(res.errors); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [instance]);

    const handleCopyAll = () => {
        const text = errors.map((e: ErrorLogEntry) =>
            `[${new Date(e.created_at).toLocaleString('pt-BR')}] ${e.recipient_phone} (${e.message_type}): ${e.error}`
        ).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', cursor: 'pointer' }}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                style={{
                    position: 'relative', width: '100%', maxWidth: 520,
                    background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 28,
                    overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
                    display: 'flex', flexDirection: 'column', maxHeight: '80vh',
                }}
            >
                {/* Top accent */}
                <div style={{ height: 3, background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)', flexShrink: 0 }} />

                {/* Header */}
                <div style={{ padding: '24px 28px 16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                                    Log de Erros
                                </h2>
                                <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                    <code style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 5 }}>
                                        {instance}
                                    </code>
                                    {!loading && <span style={{ marginLeft: 6, color: '#64748b' }}>— {errors.length} erro{errors.length !== 1 ? 's' : ''}</span>}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{
                            width: 32, height: 32, borderRadius: 8, border: 'none',
                            background: 'rgba(255,255,255,0.06)', color: '#64748b',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Scrollable error list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: '#64748b' }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: 13 }}>Carregando erros...</span>
                        </div>
                    ) : errors.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 13 }}>
                            Nenhum erro registrado para esta instância.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
                            {errors.map((e: ErrorLogEntry) => {
                                const isGroup = e.recipient_phone?.endsWith('@g.us');
                                const errorLower = (e.error || '').toLowerCase();
                                const isSessionError = errorLower.includes('sessionerror') || errorLower.includes('no sessions') || errorLower.includes('not connected');
                                const isFormatError = errorLower.includes('bad request') || errorLower.includes('invalid') || errorLower.includes('inválido');
                                const isTimeout = errorLower.includes('timed out');
                                const isInternalError = errorLower.includes('is not defined') || errorLower.includes('referenceerror') || errorLower.includes('typeerror');

                                return (
                                    <div key={e.id} style={{
                                        padding: '12px 14px', borderRadius: 14,
                                        background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>
                                                    {isGroup ? (e.recipient_phone?.split('@')[0] || 'Grupo') : (e.recipient_phone || '—')}
                                                </span>
                                                {isGroup && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#818cf8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                        Grupo
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                {isSessionError && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(239,68,68,0.2)', color: '#f87171', textTransform: 'uppercase' }}>
                                                        Sessão
                                                    </span>
                                                )}
                                                {isInternalError && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa', textTransform: 'uppercase' }}>
                                                        Interno
                                                    </span>
                                                )}
                                                {isFormatError && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', textTransform: 'uppercase' }}>
                                                        Formato
                                                    </span>
                                                )}
                                                {isTimeout && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(59,130,246,0.2)', color: '#60a5fa', textTransform: 'uppercase' }}>
                                                        Timeout
                                                    </span>
                                                )}
                                                <span style={{ fontSize: 10, color: '#475569' }}>
                                                    {new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 11, color: 'rgba(252,165,165,0.7)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                            {e.error?.replace('SessionError: ', '') || 'Erro desconhecido'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 28px 24px', flexShrink: 0, display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '12px', background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                        color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    }}>
                        Fechar
                    </button>
                    {errors.length > 0 && (
                        <button onClick={handleCopyAll} style={{
                            flex: 1, padding: '12px',
                            background: copied ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(239,68,68,0.12)',
                            border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.25)'}`,
                            borderRadius: 12, color: copied ? '#fff' : '#f87171',
                            cursor: 'pointer', fontWeight: 700, fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .2s',
                        }}>
                            {copied ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            {copied ? 'Copiado!' : 'Copiar todos os logs'}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getQrSrc = (qr: string | null) => {
    if (!qr) return '';
    const parts = qr.split(',');
    const cleanBase64 = parts[parts.length - 1].trim();
    return `data:image/png;base64,${cleanBase64}`;
};

const getStatusColor = (status: Instance['status']) => {
    switch (status) {
        case 'connected':
        case 'open':
        case 'authenticated': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
        case 'disconnected':
        case 'close': return 'text-slate-400 bg-slate-50 border-slate-100';
        case 'qr': return 'text-amber-500 bg-amber-50 border-amber-100';
        default: return 'text-blue-500 bg-blue-50 border-blue-100';
    }
};

interface SessionCardProps {
    inst: Instance;
    actionLoading: string | null;
    handleReconnect: (name: string) => void;
    setDeleteTarget: (name: string | null) => void;
    setErrorTarget: (name: string | null) => void;
    fetchInstances: () => void;
}

const SessionCard = React.memo(React.forwardRef(function SessionCard({
    inst,
    actionLoading,
    handleReconnect,
    setDeleteTarget,
    setErrorTarget,
    fetchInstances
}: SessionCardProps, _ref: any) {
    const [webhookUrl, setWebhookUrl] = useState(inst.webhook_url || '');
    const [metrics, setMetrics] = useState(inst.metrics || { sent: 0, failed: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [healthChecking, setHealthChecking] = useState(false);
    const [avatarError, setAvatarError] = useState(false);

    const avatarProxyUrl = useMemo(() => getAvatarProxyUrl(inst, 'instance'), [inst]);

    const loadData = useCallback(async (isInitial = false) => {
        // Se já temos os dados no objeto inicial da instância, evitamos fetch desnecessário no mount
        if (isInitial && inst.webhook_url !== undefined) {
            return;
        }

        try {
            const [configRes, metricsRes] = await Promise.allSettled([
                whatsappService.getInstanceConfigs(inst.instance),
                whatsappService.getInstanceMetrics(inst.instance),
            ]);

            if (configRes.status === 'fulfilled' && configRes.value.ok && configRes.value.config) {
                setWebhookUrl(configRes.value.config.webhook_url || '');
            }

            if (metricsRes.status === 'fulfilled' && metricsRes.value.ok && metricsRes.value.metrics) {
                setMetrics(metricsRes.value.metrics);
            }
        } catch (err) {
            console.error('[SessionCard:LoadData] Failed:', err);
        }
    }, [inst.instance, inst.webhook_url]);

    useEffect(() => {
        // Passamos true para indicar que é a carga inicial
        loadData(true);
        // Intervalo de atualização de configs/metrics por card aumentado para 60s para economizar recursos
        const i = setInterval(() => loadData(false), 60000);
        return () => clearInterval(i);
    }, [loadData]);

    const handleSaveWebhook = async () => {
        setIsSaving(true);
        try {
            await whatsappService.updateInstanceConfigs(inst.instance, { webhook_url: webhookUrl });
        } catch (err: any) { alert('Erro ao salvar: ' + (err as Error).message); }
        finally { setIsSaving(false); }
    };

    const handleHealthCheck = async () => {
        setHealthChecking(true);
        try {
            const res = await whatsappService.getInstances();
            const session = res.instances?.find((i: any) => i.instance === inst.instance);
            alert(session?.status === 'open' || session?.status === 'connected'
                ? 'Instância saudável e conectada!'
                : 'Instância requer atenção. Status: ' + (session?.status || 'desconhecida'));
        } catch (err: any) { alert('Erro: ' + (err as Error).message); }
        finally { setHealthChecking(false); }
    };

    // ── Reload Avatar ──
    const [refreshingAvatar, setRefreshingAvatar] = useState(false);
    const handleRefreshAvatar = async () => {
        setRefreshingAvatar(true);
        try {
            const res = await api.post('/api/session/get_profile_image', { instance_id: inst.instance });
            if (res?.profileImage) {
                setAvatarError(false);
                fetchInstances(); // re-fetch para pegar o avatar atualizado
            } else {
                alert('Nenhuma foto de perfil disponível no WhatsApp.');
            }
        } catch (err: any) {
            alert('Erro ao buscar avatar: ' + (err as Error).message);
        } finally {
            setRefreshingAvatar(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-dark-800/40 backdrop-blur-md p-5 rounded-[2.5rem] shadow-xl shadow-black/20 border border-white/5 space-y-5 flex flex-col transition-all hover:shadow-2xl hover:shadow-emerald-500/5 group"
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative group/avatar">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-inner overflow-hidden border-2 relative ${inst.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-dark-500 border-white/5'}`}>
                            {avatarProxyUrl && !avatarError ? (
                                <img
                                    src={avatarProxyUrl}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        setAvatarError(true);
                                    }}
                                />
                            ) : (
                                <span
                                    style={{ backgroundColor: getAvatarColor(inst.instance || inst.phone || 'Instancia') }}
                                    className="w-full h-full flex items-center justify-center text-white text-xl font-bold uppercase"
                                >
                                    {getAvatarInitials({ subject: inst.instance, phone: inst.phone } as any)}
                                </span>
                            )}
                            {metrics.failed > 0 && (
                                <div className="absolute top-1 right-1">
                                    <div className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Botão de Refresh Avatar */}
                        <button
                            onClick={handleRefreshAvatar}
                            disabled={refreshingAvatar}
                            className="absolute -bottom-1 -right-1 w-6 h-6 bg-dark-700 border border-white/10 rounded-full flex items-center justify-center text-dark-400 hover:text-emerald-400 hover:bg-dark-600 transition-all opacity-0 group-hover/avatar:opacity-100 cursor-pointer"
                            title="Recarregar avatar do WhatsApp"
                        >
                            {refreshingAvatar ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Camera size={12} />
                            )}
                        </button>
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="font-black text-white/90 text-xl leading-tight">{inst.phone || 'Sessão Salva'}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-dark-400 tracking-tight">
                                {inst.nome
                                    ? inst.nome
                                    : inst.phone
                                        ? String(inst.phone).replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, '+$1 ($2) $3-$4')
                                        : inst.instance.slice(0, 16) + '…'}
                            </p>
                            {inst.status === 'connected' && inst.photoUpdatesRemaining !== undefined && (
                                <span className="text-[10px] text-dark-600 font-bold uppercase tracking-wider">
                                    • {inst.photoUpdatesRemaining} cotas/mês
                                </span>
                            )}
                            {inst.partner_id && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5" title={`Parceiro ID: ${inst.partner_id}`}>
                                    🏢 {inst.partner_name || `Parceiro #${inst.partner_id}`}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {inst.status === 'connected' && (
                    <button
                        onClick={async () => {
                            if (confirm('Tem certeza que deseja desconectar o WhatsApp desta instância? Você precisará ler um novo QR Code depois.')) {
                                try {
                                    await whatsappService.disconnectInstance(inst.instance);
                                    fetchInstances();
                                } catch (err: any) { alert('Erro ao desconectar: ' + (err as Error).message); }
                            }
                        }}
                        className="bg-white/5 p-2.5 rounded-2xl text-dark-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-2 text-xs font-bold"
                        title="Desconectar Sessão"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Status + Delete button */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-dark-500 uppercase tracking-widest">Status:</span>
                <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${getStatusColor(inst.status).replace('bg-', 'bg-transparent border-')}`}>
                    {['connected', 'open', 'authenticated'].includes(inst.status || '') ? 'Conectado' : inst.status === 'qr' ? 'QR Code' : 'Desconectado'}
                </div>
                <div className="flex-1" />

                <button
                    onClick={() => setDeleteTarget(inst.instance)}
                    className="group/del flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-dark-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                >
                    <Trash2 className="w-3.5 h-3.5 transition-transform group-hover/del:scale-110" />
                    Apagar
                </button>
            </div>

            {/* Metrics */}
            <div className="bg-white/5 border border-white/5 p-3 rounded-[1.5rem] flex items-center justify-between">
                <span className="text-xs font-bold text-dark-500 uppercase tracking-widest">Métricas:</span>
                <div className="flex items-center gap-4 text-white/70 font-bold text-sm">
                    <div className="flex items-center gap-1.5">
                        <span className="text-dark-500 font-medium">Msgs:</span><span>{metrics.sent}</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <button
                        onClick={() => metrics.failed > 0 && setErrorTarget(inst.instance)}
                        className={`flex items-center gap-1.5 transition-colors ${metrics.failed > 0 ? 'text-red-400 hover:text-red-300 cursor-pointer' : 'text-white/70 cursor-default'}`}
                        disabled={metrics.failed === 0}
                        title={metrics.failed > 0 ? 'Ver log de erros' : undefined}
                    >
                        <span className="text-dark-500 font-medium">Erros:</span>
                        <span>{metrics.failed}</span>
                        {metrics.failed > 0 && <ChevronRight className="w-3 h-3" />}
                    </button>
                </div>
            </div>

            {/* Health Check */}
            <button
                onClick={handleHealthCheck}
                disabled={inst.status !== 'connected' || healthChecking}
                className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${inst.status === 'connected' ? 'bg-white/5 text-emerald-400 hover:bg-white/10' : 'bg-white/5 text-dark-500 cursor-not-allowed'}`}
            >
                {healthChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Verificar Status
            </button>

            <div className="h-px bg-white/5 mx-1" />

            {/* Webhook */}
            <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-[9px] font-black text-dark-500 uppercase tracking-[0.2em]">
                    <Globe className="w-2.5 h-2.5" /> Webhook URL (POST)
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="https://example.com/webhook"
                        value={webhookUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebhookUrl(e.target.value)}
                        className="flex-1 bg-dark-900/50 border border-white/5 rounded-2xl px-4 py-2.5 text-xs text-white/80 placeholder:text-dark-600 focus:outline-none focus:border-emerald-500/30 transition-colors shadow-inner"
                    />
                    <button
                        onClick={handleSaveWebhook}
                        disabled={isSaving}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                    </button>
                </div>
            </div>

            {/* Reconnect if disconnected */}
            {!['connected', 'open', 'authenticated'].includes(inst.status || '') && (
                <button
                    onClick={() => handleReconnect(inst.instance)}
                    disabled={actionLoading !== null}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/30 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                >
                    {actionLoading === `reconnect-${inst.instance}` ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wifi className="w-5 h-5" />}
                    Ativar Conexão
                </button>
            )}
        </motion.div>
    );
}));
SessionCard.displayName = 'SessionCard';

export default function WhatsAppSessionsPage() {
    const { user } = useAuth();
    
    // Unified store
    const instances = useWhatsAppStore((s) => s.instances);
    const saved = useWhatsAppStore((s) => s.saved);
    const loading = useWhatsAppStore((s) => s.instancesLoading);
    const refreshInstances = useWhatsAppStore((s) => s.refreshInstances);
    const createInstanceStore = useWhatsAppStore((s) => s.createInstance);

    // Context states
    const [newInstanceName, setNewInstanceName] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [errorTarget, setErrorTarget] = useState<string | null>(null);
    const [qrData, setQrData] = useState<{ name: string; qr: string | null; pairingCode?: string | null; number?: string } | null>(null);
    const [qrExpired, setQrExpired] = useState(false);

    useEffect(() => {
        refreshInstances();
        startInstancePolling(10000);
        
        chatEngine.connect(user?.uid);
        
        return () => stopInstancePolling();
    }, [refreshInstances, user?.uid]);

    // ── Bug 1 Fix: Socket.IO listener for instant modal close on connection ──
    useEffect(() => {
        if (!qrData) return;

        const offSessionConnected = chatEngine.onEvent('session:connected', (data: any) => {
            if (data?.sessionId === qrData.name) {
                console.log(`[Sessions] session:connected received for ${data.sessionId}, closing QR modal`);
                setQrData(null);        // fecha o modal instantaneamente
                refreshInstances();      // atualiza o card com status verde
            }
        });

        return () => offSessionConnected();
    }, [qrData?.name, refreshInstances]);

    // Polling de status: quando o modal QR está aberto, verifica a cada 3s se a instância conectou (fallback)
    useEffect(() => {
        if (!qrData) return;

        const instanceName = qrData.name;
        const statusInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/session/get_mine', {
                    headers: (() => {
                        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                        const h: Record<string, string> = {};
                        if (token) h['Authorization'] = `Bearer ${token}`;
                        return h;
                    })(),
                });
                const data = await res.json();
                const inst = (data?.data || []).find((r: any) => r.instance_id === instanceName);
                const connected = ['CONNECTED', 'connected', 'authenticated', 'open'].includes(inst?.status || '');
                if (connected) {
                    clearInterval(statusInterval);
                    setQrData(null);   // fecha o modal
                    refreshInstances(); // atualiza o card com status verde
                }
            } catch {
                // falha silenciosa — tenta novamente no próximo ciclo
            }
        }, 3000);

        return () => clearInterval(statusInterval);
    }, [qrData?.name, refreshInstances]);

    // Polling for QR code if null — timeout de 90s (#3)
    useEffect(() => {
        if (!qrData || qrData.qr) { setQrExpired(false); return; }

        let pollCount = 0;
        setQrExpired(false);

        const pollInterval = setInterval(async () => {
            pollCount++;
            if (pollCount > 36) {
                clearInterval(pollInterval);
                setQrExpired(true);
                return;
            }
            try {
                // Use a status-only call instead of getQrCode (which triggers /reconnect)
                const data = await whatsappService.getInstanceConfigs(qrData.name);
                if (data.success && (data.qr || data.pairingCode)) {
                    setQrExpired(false);
                    setQrData({ ...qrData, qr: data.qr, pairingCode: data.pairingCode });
                    clearInterval(pollInterval);
                }
            } catch (err: any) {
                console.error('QR Status Poll Error:', err);
                // Don't stop on single error, let it retry until timeout
            }
        }, 2500);

        return () => clearInterval(pollInterval);
    }, [qrData]);

    const handleCreateInstance = async () => {
        if (!newInstanceName.trim()) return;
        setActionLoading('create');
        try {
            const res = await createInstanceStore(newInstanceName);
            if (res.ok) {
                // Open modal immediately even if QR is not yet here (polling will catch it)
                setQrData({ name: newInstanceName, qr: res.qr || null });
                setIsAddModalOpen(false);
            }
        } catch (err: any) {
            alert('Erro ao criar instância: ' + (err as Error).message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReconnect = async (name: string) => {
        const number = window.prompt('Para conectar via Pairing Code, digite o número com DDI (ex: 551199999999).\n\nOu deixe em branco e clique em OK para conectar via QR Code:') || '';
        
        setActionLoading(`reconnect-${name}`);
        try {
            // Open modal immediately with "Generating..." state
            setQrData({ name, qr: null, number: number.trim() });
            
            const data = await whatsappService.getQrCode(name, number.trim());
            
            if (data?.status === 'connected' || (data as any)?.instance?.status === 'open') {
                alert(data?.message || 'Instância já está conectada!');
                setQrData(null); // Close modal if already connected
                refreshInstances();
            } else if (data?.qr || data?.pairingCode) {
                setQrData({ name, qr: data.qr, pairingCode: data.pairingCode, number: number.trim() });
            }
            // else: the polling effect already started when setQrData was called 
            // at the beginning of try block, so we just let it continue.
        } catch (err: any) {
            alert('Erro ao reconectar: ' + (err.response?.data?.error || err.message || 'Erro desconhecido'));
        } finally {
            setActionLoading(null);
        }
    };

    const allSessions = useMemo(() => {
        const unified = [...instances];
        saved.forEach((name: string) => {
            if (!instances.some((inst: Instance) => inst.instance === name)) {
                unified.push({ instance: name, status: 'disconnected', hasQr: false, createdAt: new Date().toISOString() } as Instance);
            }
        });
        return unified;
    }, [instances, saved]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <Wifi className="w-6 h-6" />
                        </div>
                        Gerenciar Instâncias
                    </h1>
                    <p className="text-dark-400 mt-1">Conecte e gerencie seus números de WhatsApp via Evolution API.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
                >
                    <Plus className="w-5 h-5" /> Adicionar Instância
                </button>
            </header>

            {/* Session Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {loading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="glass h-64 rounded-3xl animate-pulse bg-white/5" />
                        ))
                    ) : allSessions.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-6"
                        >
                            <div className="w-24 h-24 bg-dark-800 rounded-full flex items-center justify-center text-dark-500">
                                <Phone className="w-12 h-12" />
                            </div>
                            <div className="max-w-xs mx-auto">
                                <h2 className="text-xl font-bold text-white">Nenhuma instância encontrada</h2>
                                <p className="text-dark-400 mt-2">Crie sua primeira instância WhatsApp para começar.</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10">
                                <Plus className="w-5 h-5" /> Adicionar Instância
                            </button>
                        </motion.div>
                    ) : (
                        allSessions.map((inst: Instance) => (
                            <SessionCard
                                key={inst.instance}
                                inst={inst}
                                actionLoading={actionLoading}
                                handleReconnect={handleReconnect}
                                setDeleteTarget={setDeleteTarget}
                                setErrorTarget={setErrorTarget}
                                fetchInstances={refreshInstances}
                            />
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Delete Modal ────────────────────────────────────────────────── */}
            <AnimatePresence>
                {deleteTarget && (
                    <DeleteModal
                        instance={deleteTarget}
                        onClose={() => setDeleteTarget(null)}
                        onDone={refreshInstances}
                    />
                )}
            </AnimatePresence>

            {/* ─── Error Logs Modal ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {errorTarget && (
                    <ErrorLogsModal
                        instance={errorTarget}
                        onClose={() => setErrorTarget(null)}
                    />
                )}
            </AnimatePresence>

            {/* ─── QR Code Modal ───────────────────────────────────────────────── */}
            <AnimatePresence>
                {qrData && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQrData(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative glass p-10 rounded-[3rem] border border-white/10 max-w-sm w-full text-center space-y-8">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white">Conectar WhatsApp</h2>
                                <p className="text-dark-400 text-sm">
                                    {qrData.pairingCode ? 'Digite o código abaixo no seu WhatsApp.' : 'Escaneie o código abaixo com seu celular.'}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-2xl min-h-[304px] flex flex-col items-center justify-center">
                                {qrExpired ? (
                                    <div className="w-64 h-64 flex flex-col items-center justify-center gap-4">
                                        <div className="text-5xl">⏱</div>
                                        <p className="font-black text-sm text-gray-700 text-center">Código expirado</p>
                                        <p className="text-xs text-gray-400 text-center">A conexão tem um tempo limite.<br />Gere um novo para conectar.</p>
                                        <button
                                            onClick={() => { setQrData({ name: qrData!.name, qr: null, number: qrData!.number }); setQrExpired(false); }}
                                            className="mt-2 px-5 py-2 bg-emerald-500 text-white text-xs font-bold rounded-2xl hover:bg-emerald-400 transition-colors"
                                        >Tentar novamente</button>
                                    </div>
                                ) : qrData.pairingCode ? (
                                    <div className="w-64 h-64 flex flex-col items-center justify-center gap-6">
                                        <p className="text-dark-400 text-xs font-bold uppercase tracking-widest text-center">Pairing Code</p>
                                        <div className="text-3xl font-black text-emerald-600 bg-emerald-50 px-6 py-4 rounded-3xl border-2 border-emerald-100 tracking-[0.1em]">
                                            {qrData.pairingCode}
                                        </div>
                                    </div>
                                ) : qrData.qr ? (
                                    <img src={getQrSrc(qrData.qr)} alt="QR Code" className="w-64 h-64" />
                                ) : (
                                    <div className="w-64 h-64 flex flex-col items-center justify-center gap-4 text-dark-800">
                                        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                                        <p className="font-bold text-xs uppercase tracking-widest text-dark-400">Gerando código...</p>
                                    </div>
                                )}
                            </div>
                            {!qrExpired && (
                                <div className="flex items-center justify-center gap-3 text-emerald-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                                    <RefreshCw className="w-4 h-4 animate-spin" /> Aguardando Pareamento...
                                </div>
                            )}
                            <button onClick={() => setQrData(null)} className="w-full py-4 text-dark-400 hover:text-white font-bold transition-colors">Fechar</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Add Instance Modal ──────────────────────────────────────────── */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative glass p-8 rounded-[3rem] border border-white/10 max-w-sm w-full space-y-8">
                            <div>
                                <h2 className="text-2xl font-black text-white">Nova Instância</h2>
                                <p className="text-dark-400 text-sm mt-2">Dê um nome para identificar esta conexão.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-dark-500 uppercase tracking-widest px-2">Nome da Instância</label>
                                <input
                                    type="text" value={newInstanceName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewInstanceName(e.target.value)}
                                    placeholder="Ex: main, comercial, suporte..."
                                    className="w-full bg-dark-900 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                                />
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 text-dark-400 font-bold hover:text-white transition-colors">Cancelar</button>
                                <button onClick={handleCreateInstance} disabled={actionLoading !== null} className="flex-1 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50">
                                    {actionLoading === 'create' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Criar'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
