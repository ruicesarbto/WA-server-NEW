'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, Send, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Instance {
    id: string;
    nome: string;
    avatar: string | null;
    phone: string | null;
}

interface NewConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSent: (phone: string, instanceId: string) => void;
    activeInstance: Instance | null;
    connectedInstances: Instance[];
    sendMessage: (instanceId: string, phone: string, text: string) => Promise<{ ok: boolean; messageId?: string }>;
}

function normalizePhoneForSend(input: string): string {
    const digits = input.replace(/\D/g, '');
    // Already has Brazil country code: 55 + DDD (2) + number (8-9) = 12-13 digits
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
    // Local Brazilian number: DDD (2) + number (8-9) = 10-11 digits
    if (digits.length === 10 || digits.length === 11) return '55' + digits;
    // Return as-is (international or unusual)
    return digits;
}

export default function NewConversationModal({
    isOpen,
    onClose,
    onSent,
    activeInstance,
    connectedInstances,
    sendMessage,
}: NewConversationModalProps) {
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [selectedInstanceId, setSelectedInstanceId] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const phoneInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPhone('');
            setMessage('');
            setError('');
            setSent(false);
            setSending(false);
            setSelectedInstanceId(activeInstance?.id || connectedInstances[0]?.id || '');
            setTimeout(() => phoneInputRef.current?.focus(), 120);
        }
    }, [isOpen, activeInstance?.id, connectedInstances]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(e.target.value.replace(/[^\d\s\-()+]/g, ''));
        setError('');
    };

    const handleSubmit = async () => {
        const normalized = normalizePhoneForSend(phone);
        const digits = normalized.replace(/\D/g, '');

        if (digits.length < 10) {
            setError('Número inválido. Informe DDD + número (ex: 67 99922-2377)');
            phoneInputRef.current?.focus();
            return;
        }
        if (!message.trim()) {
            setError('Escreva uma mensagem para iniciar a conversa');
            textareaRef.current?.focus();
            return;
        }
        if (!selectedInstanceId) {
            setError('Nenhuma instância conectada');
            return;
        }

        setSending(true);
        setError('');

        try {
            const result = await sendMessage(selectedInstanceId, normalized, message.trim());
            if (!result.ok) throw new Error('Envio falhou');
            setSent(true);
            // Brief success state, then close and notify parent
            setTimeout(() => {
                onSent(normalized, selectedInstanceId);
                onClose();
            }, 1300);
        } catch (err: any) {
            setError(err?.message || 'Erro ao enviar. Verifique o número e tente novamente.');
            setSending(false);
        }
    };

    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') textareaRef.current?.focus();
    };

    const canSend = !!phone.trim() && !!message.trim() && !!selectedInstanceId && !sending && !sent;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={!sending ? onClose : undefined}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0, y: 16 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-[#008069] text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold leading-tight">Nova Conversa</h2>
                                    <p className="text-[11px] text-white/70 leading-tight">Enviar primeira mensagem</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={sending}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Instance selector — only if multiple instances connected */}
                            {connectedInstances.length > 1 && (
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                        Enviar como
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedInstanceId}
                                            onChange={(e) => setSelectedInstanceId(e.target.value)}
                                            disabled={sending || sent}
                                            className="w-full appearance-none bg-[#f0f2f5] rounded-xl px-4 py-2.5 pr-10 text-sm text-[#111b21] font-medium focus:outline-none focus:ring-2 focus:ring-[#008069]/40 disabled:opacity-60"
                                        >
                                            {connectedInstances.map(inst => (
                                                <option key={inst.id} value={inst.id}>
                                                    {inst.nome}{inst.phone ? ` (+${inst.phone})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Phone input */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                    Número do WhatsApp
                                </label>
                                <div className="flex items-center gap-2 bg-[#f0f2f5] rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#008069]/40 transition-all">
                                    <span className="text-gray-400 text-sm select-none shrink-0">🇧🇷 +55</span>
                                    <div className="w-px h-5 bg-gray-300 shrink-0" />
                                    <input
                                        ref={phoneInputRef}
                                        type="tel"
                                        placeholder="(67) 99922-2377"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        onKeyDown={handlePhoneKeyDown}
                                        disabled={sending || sent}
                                        className="flex-1 bg-transparent text-sm text-[#111b21] placeholder:text-[#8696a0] focus:outline-none disabled:opacity-60 min-w-0"
                                    />
                                </div>
                            </div>

                            {/* Message textarea */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                    Mensagem
                                </label>
                                <textarea
                                    ref={textareaRef}
                                    rows={3}
                                    placeholder="Olá! Tudo bem?"
                                    value={message}
                                    onChange={(e) => { setMessage(e.target.value); setError(''); }}
                                    onKeyDown={handleTextareaKeyDown}
                                    disabled={sending || sent}
                                    className="w-full bg-[#f0f2f5] rounded-xl px-4 py-3 text-sm text-[#111b21] placeholder:text-[#8696a0] focus:outline-none focus:ring-2 focus:ring-[#008069]/40 resize-none transition-all disabled:opacity-60"
                                />
                                <p className="text-[11px] text-gray-400 mt-1 text-right">Ctrl+Enter para enviar</p>
                            </div>

                            {/* Error */}
                            <AnimatePresence>
                                {error && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5"
                                    >
                                        {error}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 flex items-center justify-between">
                            <button
                                onClick={onClose}
                                disabled={sending}
                                className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!canSend}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    sent
                                        ? 'bg-green-500'
                                        : sending
                                        ? 'bg-[#008069]/80'
                                        : 'bg-[#008069] hover:bg-[#017259]'
                                }`}
                            >
                                {sent ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Enviado!
                                    </>
                                ) : sending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Enviar
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
