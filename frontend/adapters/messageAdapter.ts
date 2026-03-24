export function normalizeMessage(raw: any) {
  return {
    id: raw.id,
    chatId: raw.chatId,
    content: raw.content,
    direction: raw.direction,
    status: raw.status || "delivered",
    timestamp: raw.timestamp || Date.now()
  }
}
