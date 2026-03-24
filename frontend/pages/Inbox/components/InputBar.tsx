'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
    Smile,
    Paperclip,
    Mic,
    Send,
    X,
    StopCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useChatStore } from "@/store/chatStore";

interface Message {
    id: number;
    chat_id: number;
    message_id: string;
    text: string;
    direction: 'in' | 'out';
}

interface InputBarProps {
    newMessage: string;
    onNewMessageChange: (val: string) => void;
    onSend: (e?: React.FormEvent) => void;
    onPresence: () => void;
    onSendMedia: (file: File) => Promise<void>;
    onSendAudio: (blob: Blob) => Promise<void>;
    replyingTo: Message | null;
    onCancelReply: () => void;
    isMobile: boolean;
    selectedChat: any;
}

const InputBar: React.FC<InputBarProps> = ({
    newMessage,
    onNewMessageChange,
    onSend,
    onPresence,
    onSendMedia,
    onSendAudio,
    replyingTo,
    onCancelReply,
    isMobile,
    selectedChat,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    // Audio recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-expand textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [newMessage]);

    // Close emoji picker on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const onEmojiClick = (emojiData: any) => {
        onNewMessageChange(newMessage + emojiData.emoji);
        // Do not close picker, common UX allows multiple emojis
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await onSendMedia(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
                await onSendAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Falha ao iniciar gravação de áudio:', err);
            alert('Não foi possível acessar o microfone.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="relative z-20">
            {/* Hidden File Input */}
            <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />

            {/* Emoji Picker Popover */}
            <AnimatePresence>
                {showEmojiPicker && (
                    <motion.div
                        ref={emojiPickerRef}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-100"
                    >
                        <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            autoFocusSearch={false}
                            theme={Theme.LIGHT}
                            width={320}
                            height={400}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reply Preview */}
            <AnimatePresence>
                {replyingTo && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="mx-4 mb-2 bg-[#f0f2f5] border-l-[4px] border-[#00a884] rounded-lg px-4 py-3 flex items-start justify-between gap-4 shadow-sm"
                    >
                        <div className="min-w-0">
                            <div className="text-[12px] font-medium text-[#00a884] mb-1">
                                {replyingTo.direction === 'out' ? 'Respondendo a você' : 'Respondendo ao contato'}
                            </div>
                            <div className="text-sm text-gray-500 font-medium truncate italic">
                                {replyingTo.text || 'Anexo/Mídia'}
                            </div>
                        </div>
                        <button
                            type="button"
                            className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-1 rounded-full transition-colors"
                            onClick={onCancelReply}
                        >
                            <X className="w-3.5 h-3.5 stroke-[3px]" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Input Bar - Matches WhatsApp Web */}
            <div className="min-h-[62px] px-4 py-2 bg-[#f0f2f5] flex items-center gap-2 border-t border-[#d1d7db] shrink-0">
                {!isRecording ? (
                    <>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 hover:bg-[#dfe5e7] rounded-full transition-all text-[#54656f] active:scale-95"
                                title="Anexar"
                            >
                                <Paperclip className="w-[26px] h-[26px] rotate-45" />
                            </button>
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className={`p-2 hover:bg-[#dfe5e7] rounded-full transition-all active:scale-95 ${showEmojiPicker ? 'text-[#00a884]' : 'text-[#54656f]'}`}
                                title="Emojis"
                            >
                                <Smile className="w-[26px] h-[26px]" />
                            </button>
                        </div>

                        <div className="flex-1">
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                placeholder="Digite uma mensagem"
                                className="w-full px-3 py-2.5 bg-white rounded-lg text-[15px] text-[#111b21] border-none focus:ring-0 focus:outline-none placeholder:text-[#667781] resize-none shadow-sm transition-all overflow-hidden leading-[1.4]"
                                value={newMessage}
                                onChange={(e) => {
                                    onNewMessageChange(e.target.value);
                                    onPresence();
                                }}
                                onKeyDown={handleKeyDown}
                            />
                        </div>

                        <div className="transition-all flex items-center">
                            {newMessage.trim() ? (
                                <motion.button
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    onClick={() => onSend()}
                                    className="p-2 text-[#54656f] hover:bg-[#dfe5e7] rounded-full transition-all active:scale-90"
                                >
                                    <Send className="w-[26px] h-[26px]" />
                                </motion.button>
                            ) : (
                                <button
                                    onClick={startRecording}
                                    className="p-2 hover:bg-[#dfe5e7] rounded-full transition-all text-[#54656f] active:scale-90"
                                >
                                    <Mic className="w-[26px] h-[26px]" />
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-between bg-red-50/50 rounded-2xl px-4 py-2 animate-pulse border border-red-100 shadow-inner">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                            <span className="text-sm font-bold text-red-600 tracking-wider">
                                GRAVANDO {formatDuration(recordingDuration)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (mediaRecorderRef.current) {
                                        mediaRecorderRef.current.onstop = null; // Don't send
                                        mediaRecorderRef.current.stop();
                                        setIsRecording(false);
                                        if (timerRef.current) clearInterval(timerRef.current);
                                    }
                                }}
                                className="p-2 hover:bg-red-100 rounded-full text-red-400 transition-colors"
                                title="Cancelar"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <button
                                onClick={stopRecording}
                                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-md active:scale-90"
                                title="Parar e Enviar"
                            >
                                <StopCircle className="w-6 h-6 fill-current" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InputBar;
