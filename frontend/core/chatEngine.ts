import { io, Socket } from "socket.io-client"
import { useChatStore } from "../store/chatStore"
import { useWhatsAppStore } from "../pages/Inbox/whatsappStore"

class ChatEngine {
  socket: Socket | null = null
  listeners: Array<(event: string, data: any) => void> = []
  private currentInstance: string | null = null;
  private currentUserId: string | null = null;

  async connect(userId?: string) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8001";
    const instanceName = typeof window !== 'undefined' ? localStorage.getItem("instance_name") : null;
    const uid = userId || null;
    
    // Prevent redundant connections to same targets
    // if socket exists and is active (connecting or connected) with same params, skip
    if (this.socket && (this.socket as any).active && this.currentInstance === instanceName && this.currentUserId === uid) {
      return;
    }

    this.currentInstance = instanceName;
    this.currentUserId = uid;

    if (this.socket) {
       this.socket.disconnect();
    }

    console.log(`Socket connecting to ${socketUrl} (instance: ${instanceName || 'none'})`);

    this.socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      query: instanceName ? { instance: instanceName } : {},
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    this.socket.on("connect", () => {
      console.log("Connected to Chat Engine Socket");
      if (userId) {
        this.socket?.emit("user_connected", { userId });
      }
    });

    this.socket.on("push_new_msg", (data: any) => {
      this.fireEvent("push_new_msg", data);
      const r = data?.msg;
      if (!r) return;
      const newMsg: any = {
          id: Date.now(),
          chat_id: 0,
          message_id: r.msgId || `${r.timestamp}-${Date.now()}`,
          text: r.msgContext?.text || r.text || '',
          type: r.type || 'text',
          direction: r.route === 'outgoing' ? 'out' : 'in',
          status: r.status || (r.route === 'outgoing' ? 'sent' : 'pending'),
          timestamp: r.timestamp ? new Date(Number(r.timestamp) * 1000).toISOString() : new Date().toISOString(),
          media_url: r.msgContext?.url || r.msgContext?.mediaUrl || r.media_url || null,
          media_type: r.type !== 'text' ? r.type : undefined,
          reactions: r.reaction ? { [r.reaction]: r.reaction } : null,
          message_payload: r,
          participant: r.senderName || null,
          quoted_message_text: r.context?.id ? "Mensagem citada" : undefined,
      };
      
      useChatStore.getState().receiveMessage({
          ...newMsg,
          chatId: r.remoteJid
      });

      useWhatsAppStore.getState().upsertMessageEvent({
          remoteJid: r.remoteJid,
          text: newMsg.text,
          timestampIso: newMsg.timestamp,
          fromMe: newMsg.direction === 'out',
          status: newMsg.status as any,
          messageId: newMsg.message_id,
          messagePayload: r,
          pushName: r.pushName || r.senderName,
          instanceName: r.instanceName,
          messageType: newMsg.type,
          participantName: r.senderName,
      });
    });

    this.socket.on("update_conversations", (data: any) => {
      this.fireEvent("update_conversations", data);
      useWhatsAppStore.getState().fetchChats();
    });

    this.socket.on("user:typing", (data: any) => {
      this.fireEvent("user:typing", data);
    });

    this.socket.on("session:status", (data: any) => {
      this.fireEvent("session:status", data);
    });

    this.socket.on("push_new_reaction", (data: any) => {
      this.fireEvent("push_new_reaction", data);
      const r = data?.reaction;
      if (!r || !r.remoteJid) return;
      useWhatsAppStore.getState().updateChatLastReaction(
          r.remoteJid,
          `Reação: ${r.text}`,
          new Date().toISOString(),
          r.fromMe
      );
    });

    this.socket.on("chat:list", (chats: any) => {
      this.fireEvent("chat:list", chats);
    });

    this.socket.on("message:new", (msg: any) => {
      this.fireEvent("message:new", msg);
    });

    this.socket.on("session:connected", (data: any) => {
      this.fireEvent("session:connected", data);
    });

    this.socket.on("media:ready", (data: any) => {
      this.fireEvent("media:ready", data);
    });

    this.socket.on("message:status_update", (data: any) => {
      this.fireEvent("message:status_update", data);
      if (data?.chatId && data?.msgId && data?.status) {
        useChatStore.getState().updateMessageStatus(data.chatId, data.msgId, data.status);
      }
    });

    this.socket.on("message:reaction", (data: any) => {
      this.fireEvent("message:reaction", data);
      if (data?.chatId && data?.msgId !== undefined) {
        useChatStore.getState().updateMessageReaction(data.chatId, data.msgId, data.reaction ?? '');
      }
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from Chat Engine");
    });
  }

  onEvent(event: string, cb: (data: any) => void) {
    const wrapped = (e: string, d: any) => {
       if (e === event) cb(d);
    };
    this.listeners.push(wrapped);
    return () => {
       this.listeners = this.listeners.filter(l => l !== wrapped);
    };
  }

  fireEvent(event: string, data: any) {
    for (const listener of this.listeners) {
       listener(event, data);
    }
  }

  sendMessage(msg: any) {
    this.socket?.emit("message:send", msg);
  }
}

export const chatEngine = new ChatEngine()
