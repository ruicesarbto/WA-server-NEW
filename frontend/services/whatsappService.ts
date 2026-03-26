import { api } from '@/lib/api';
import { WhatsAppChat } from '../pages/Inbox/whatsappStore';
import { WhatsAppInstance } from '../pages/Inbox/types';

/**
 * Service Layer for WhatsApp / whatsapp API
 * Isolates API calls from components, adds normalization and type safety.
 */
export const whatsappService = {
    // ─── INSTANCES ───
    async getInstances(): Promise<{ instances: WhatsAppInstance[], saved: string[] }> {
        return api.getWhatsAppInstances() as any;
    },

    async createInstance(name: string): Promise<{ ok: boolean, qr?: string }> {
        const res = await api.createWhatsAppInstance(name);
        return { ok: res.success || res.ok, qr: res.qr };
    },

    async getQrCode(name: string, number?: string) {
        return api.getWhatsAppQr(name, number);
    },

    async disconnectInstance(name: string) {
        return api.disconnectWhatsAppInstance(name);
    },

    async updatePhoto(name: string) {
        return api.updateWhatsAppPhoto(name);
    },

    // ─── CHATS & HISTORY ───
    async getChats(activeInstance?: string): Promise<{ chats: WhatsAppChat[] }> {
        if (!activeInstance) return { chats: [] };
        return api.getWhatsAppChats(activeInstance);
    },
    
    async getContacts(activeInstance: string): Promise<{ contacts: any[] }> {
        return api.getWhatsAppContacts(activeInstance);
    },

    async getGroups(activeInstance: string): Promise<{ groups: any[] }> {
        return api.getWhatsAppGroups(activeInstance);
    },

    async getHistory(phone: string, instance?: string, remoteJid?: string, chatId?: string, cursor?: string | null) {
        return api.getWhatsAppHistory(phone, 50, 0, instance, remoteJid, chatId, cursor);
    },

    // ─── MESSAGING ───
    async sendText(
        instance: string,
        to: string,
        text: string,
        leadId?: number | string,
        quotedId?: string,
        remoteJid?: string,
        quoted?: { key: { id: string; remoteJid: string; fromMe?: boolean; participant?: string } },
        chatId?: string | null,
        toName?: string | null,
    ) {
        return api.sendWhatsAppText(instance, to, text, leadId, quotedId, remoteJid, quoted, chatId, toName);
    },

    async sendMedia(instance: string, to: string, url: string, mediaType: string, caption?: string, leadId?: number | string) {
        return api.sendWhatsAppMedia(instance, to, url, mediaType, caption, leadId);
    },

    async sendAudio(instance: string, to: string, url: string, leadId?: number | string) {
        return api.sendWhatsAppAudio(instance, to, url, leadId);
    },

    // ─── ACTIONS ───
    async editMessage(instance: string, remoteJid: string, messageId: string, text: string) {
        return api.editWhatsAppMessage(instance, remoteJid, messageId, text);
    },

    async blockContact(instance: string, remoteJid: string, block: boolean) {
        return api.blockWhatsAppContact(instance, remoteJid, block);
    },

    async markAsRead(remoteJid: string, instanceName: string, messageId?: string): Promise<void> {
        return api.markWhatsAppAsRead(remoteJid, instanceName, messageId);
    },

    async reactMessage(instance: string, remoteJid: string, messageId: string, emoji: string) {
        return api.reactWhatsAppMessage(instance, remoteJid, messageId, emoji);
    },

    async deleteMessage(instance: string, remoteJid: string, messageId: string) {
        return api.deleteWhatsAppMessage(instance, remoteJid, messageId);
    },

    async forwardMessage(instance: string, to: string, messagePayload: any) {
        return api.forwardWhatsAppMessage(instance, to, messagePayload);
    },

    // ─── PRESENCE & STATUS ───
    async sendPresence(to: string, presence: 'composing' | 'recording' | 'available' | 'unavailable', instance: string) {
        return api.sendWhatsAppPresence(to, presence, instance);
    },

    // ─── EVENTS & SYNC ───
    async syncEvents(after: number = 0) {
        return api.syncWhatsAppEvents(after);
    },

    async syncAvatar(jid: string, instanceName: string) {
        return api.syncWhatsAppAvatar(jid, instanceName);
    },

    async syncGroupMetadata(remoteJid: string, instanceName: string): Promise<{ ok: boolean, subject?: string }> {
        return api.syncWhatsAppGroupMetadata(remoteJid, instanceName);
    },

    // ─── LABELS & METADATA ───
    async getLabels(instanceName: string) {
        return api.getWhatsAppLabels(instanceName);
    },

    // ─── CHAT MANAGEMENT ───
    async pinChat(chatId: number, pinned = true) {
        return api.pinWhatsAppChat(chatId, pinned);
    },

    async muteChat(chatId: number, muted = true, until?: string) {
        return api.muteWhatsAppChat(chatId, muted, until);
    },

    async archiveChat(chatId: number, archived = true) {
        return api.archiveWhatsAppChat(chatId, archived);
    },

    async deleteChat(chatId: number) {
        return api.deleteWhatsAppChat(chatId);
    },

    async uploadFile(file: File) {
        return api.uploadFile(file);
    },

    async deleteInstance(name: string, mode?: string) {
        const res = await api.deleteWhatsAppInstance(name, mode);
        return { ok: res.success, msg: res.msg };
    },

    async getInstanceErrors(instance: string, limit: number = 50) {
        return api.getInstanceErrors(instance, limit);
    },

    async getInstanceConfigs(instance: string) {
        return api.getInstanceConfigs(instance);
    },

    async getInstanceMetrics(instance: string) {
        return api.getInstanceMetrics(instance);
    },

    async updateInstanceConfigs(instance: string, data: any) {
        return api.updateInstanceConfigs(instance, data);
    }
};

// Data Normalization Utils (Ensuring parity between whatsapp API, Backend and Frontend)
export const whatsappUtils = {
    normalizePhone(jid: string): string {
        if (!jid) return '';
        const [user] = jid.split('@');
        const [cleanUser] = user.split(':');
        return cleanUser;
    },

    toISODate(timestamp: string | number | null): string {
        if (!timestamp) return new Date().toISOString();
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    },

    isGroupJid(jid: string): boolean {
        return !!jid && jid.endsWith('@g.us');
    }
};
