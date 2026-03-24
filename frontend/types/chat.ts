export type Message = {
  id: string
  chatId: string
  content: string
  direction: "in" | "out"
  status: "pending" | "sent" | "delivered" | "read"
  timestamp: number
}

export type Chat = {
  id: string
  name: string
  unreadCount: number
  lastMessage?: Message
}
