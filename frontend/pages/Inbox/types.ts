export interface Message {
    id: number;
    chat_id: number;
    message_id: string;
    text: string;
    type: string;
    direction: 'in' | 'out';
    status: 'sending' | 'pending' | 'sent' | 'server_ack' | 'delivered' | 'read' | 'played' | 'deleted' | 'failed' | 'error';
    timestamp: string;
    media_url?: string;
    media_type?: string;
    media_size?: number;
    quoted_id?: string | null;
    quoted_message_id?: string | null;
    quoted_message_text?: string | null;
    quoted_participant?: string | null;
    reactions?: Record<string, string> | null;
    reaction?: string | null;      // Novo: emoji único do pipeline em tempo real
    message_payload?: any;
    participant?: string | null;
}

export interface WhatsAppInstance {
    instance: string;
    /** whatsapp API status: open, connected, disconnected, connecting, etc. */
    status: 'connecting' | 'qr' | 'connected' | 'disconnected' | 'open' | 'close' | 'authenticated';
    phone?: string;
    hasQr: boolean;
    createdAt: string;
    profilePictureUrl?: string;
    photoUpdatesRemaining?: number;
    partner_id?: number | null;
    partner_name?: string | null;
    /** For UI display primarily from the Console/Admin View */
    id?: string;
    nome?: string;
    avatar?: string | null;
    webhook_url?: string;
    metrics?: {
        sent: number;
        failed: number;
    };
}

export type PurgeMode = 'all' | 'data_only';
export type StepStatus = 'waiting' | 'running' | 'ok' | 'error' | 'skip';

export interface PurgeStep {
    id: string;
    label: string;
    detail: string;
    icon?: any;
    status: StepStatus;
}
