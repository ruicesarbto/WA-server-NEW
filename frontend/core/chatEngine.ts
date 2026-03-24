import { io, Socket } from "socket.io-client"

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
    });

    this.socket.on("update_conversations", (data: any) => {
      this.fireEvent("update_conversations", data);
    });

    this.socket.on("user:typing", (data: any) => {
      this.fireEvent("user:typing", data);
    });

    this.socket.on("session:status", (data: any) => {
      this.fireEvent("session:status", data);
    });

    this.socket.on("push_new_reaction", (data: any) => {
      this.fireEvent("push_new_reaction", data);
    });

    this.socket.on("chat:list", (chats: any) => {
      this.fireEvent("chat:list", chats);
    });

    this.socket.on("message:new", (msg: any) => {
      this.fireEvent("message:new", msg);
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
