import { MOCK_USERS } from "./social-data";

export interface Message {
  id: string;
  senderUsername: string;
  text: string;
  createdAt: Date;
  readAt?: Date;
}

export interface Conversation {
  username: string;
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
}

export const CURRENT_USERNAME = "you";

/**
 * Mesaj kutusu fake datadan temizlendi.
 * Yeni kullanıcılar boş bir inbox ile başlar; gerçek konuşmalar
 * sohbet açıldıkça `messaging.ts` storage'ına eklenir.
 */
export const SEED_CONVERSATIONS: Conversation[] = [];

// Helper to get partner display info from MOCK_USERS
export function getPartnerInfo(username: string) {
  return MOCK_USERS.find((u) => u.username === username);
}
