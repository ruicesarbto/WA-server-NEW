import { create } from "zustand"

export const useChatStore = create<any>((set: any, get: any) => ({
  chats: {},
  messages: {},
  activeChatId: null,

  setActiveChat: (id: any) => set({ activeChatId: id }),

  setChats: (chats: any[]) => {
    const map: any = {}
    chats.forEach(c => map[c.id] = c)
    
    // Prevent infinite loop if data is identical
    if (JSON.stringify(get().chats) === JSON.stringify(map)) return
    
    set({ chats: map })
  },

  receiveMessage: (msg: any) => {
    set((state: any) => {
      // Normalize chatId (remoteJid often used as chatId in frontend)
      const chatId = msg.chatId || msg.remote_jid || msg.remoteJid;
      if (!chatId) return state;

      const list = state.messages[chatId] || [];
      const msgId = msg.id || msg.message_id || msg.messageId;

      // Deduplicate by message ID
      if (list.find((m: any) => (m.id || m.message_id || m.messageId) === msgId)) {
        return state;
      }

      // Format message for UI
      const newMessage = {
        id: msgId || Date.now(),
        message_id: msgId,
        chatId: chatId,
        text: msg.text || msg.content || "",
        content: msg.text || msg.content || "",
        direction: msg.direction || (msg.fromMe ? "out" : "in"),
        status: msg.status || "delivered",
        timestamp: msg.timestamp || msg.timestampIso || new Date().toISOString(),
        message_payload: msg.message_payload || msg,
      };

      const updatedList = [...list, newMessage].sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return {
        messages: {
          ...state.messages,
          [chatId]: updatedList
        }
      };
    });
  },

  sendMessage: (content: any) => {
    const chatId = (get() as any).activeChatId
    if (!chatId) return

    const tempMsg = {
      id: "temp_" + Date.now(),
      chatId,
      content,
      direction: "out",
      status: "pending",
      timestamp: Date.now()
    }

    ;(get() as any).receiveMessage(tempMsg)

    import("../core/chatEngine").then(({ chatEngine }) => {
      chatEngine.sendMessage(tempMsg)
    })
  },

  patchChat: (id: any, data: any) => set((state: any) => ({
    chats: {
      ...state.chats,
      [id]: { ...(state.chats[id] || {}), ...data }
    }
  })),

  setMessages: (chatId: any, messages: any[]) => set((state: any) => ({
    messages: {
      ...state.messages,
      [chatId]: messages.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }
  })),

  removeChat: (id: any) => set((state: any) => {
    const next = { ...state.chats }
    delete next[id]
    return { chats: next }
  })
}))
