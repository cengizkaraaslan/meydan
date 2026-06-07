import "server-only";

import { MOCK_USERS } from "./social-data";
import { db } from "./db";
import { withDb } from "./db-fallback";

/**
 * Etkinlik bazlı group chat store — hibrit.
 *
 * DATABASE_URL varsa (isDbConfigured) mesajlar Prisma ChatMessage tablosuna
 * yazılır/okunur; tablo yoksa veya DB hatası olursa in-memory fallback'e düşülür
 * (withDb). DB modunda seed YOK — gerçek mesajlar gösterilir (oda boşsa boş döner).
 *
 * Anahtar = etkinlik slug (her zaman lowercase).
 * In-memory fallback modunda her oda 3 seed mesajla başlar (MOCK_USERS'tan).
 *
 * NOT: Canlı SSE bus (event-chat-bus.ts) yerinde kalır; burada yalnızca
 * kalıcılık DB'ye taşınır.
 *
 * globalThis singleton — Next.js RSC sandbox sorununu by-pass eder
 * (DM tarafında messaging-bus aynısını yapıyor).
 */

export interface EventChatMessage {
  id: string;
  senderUsername: string;
  senderName: string;
  senderColor: string;
  text: string;
  /** ISO date string — RSC payload + SSE iletisi aynı tip olsun */
  createdAt: string;
}

export interface EventChatRoom {
  slug: string;
  messages: EventChatMessage[];
}

declare global {
  // eslint-disable-next-line no-var
  var __etkinlikscoutEventChatRooms:
    | Map<string, EventChatRoom>
    | undefined;
}

const ROOMS: Map<string, EventChatRoom> =
  globalThis.__etkinlikscoutEventChatRooms ??
  (globalThis.__etkinlikscoutEventChatRooms = new Map());

export const CURRENT_USERNAME = "you";

const SEED_TEMPLATES: Array<{ userIdx: number; text: string; minutesAgo: number }> = [
  { userIdx: 0, text: "Selam herkese! Etkinliğe gelecek olanlarla burada buluşalım 🎉", minutesAgo: 240 },
  { userIdx: 3, text: "Süper fikir! Ben de varım, sahne önünde buluşmaya ne dersiniz?", minutesAgo: 180 },
  { userIdx: 5, text: "Park yeri bulan haber etsin lütfen 🚗", minutesAgo: 60 },
];

function buildSeedMessages(slug: string): EventChatMessage[] {
  return SEED_TEMPLATES.map((tmpl, i) => {
    const u = MOCK_USERS[tmpl.userIdx];
    return {
      id: `${slug}-seed-${i}`,
      senderUsername: u.username,
      senderName: u.name,
      senderColor: u.color,
      text: tmpl.text,
      createdAt: new Date(Date.now() - tmpl.minutesAgo * 60_000).toISOString(),
    };
  });
}

export function getOrCreateRoom(slug: string): EventChatRoom {
  const key = slug.toLowerCase();
  const existing = ROOMS.get(key);
  if (existing) return existing;
  const fresh: EventChatRoom = {
    slug: key,
    messages: buildSeedMessages(key),
  };
  ROOMS.set(key, fresh);
  return fresh;
}

// -----------------------------------------------------------------------------
// DB satırı → EventChatMessage (createdAt ISO string'e çevrilir)
// -----------------------------------------------------------------------------
interface ChatMessageRow {
  id: string;
  senderUsername: string;
  senderName: string;
  senderColor: string;
  text: string;
  createdAt: Date;
}

function rowToMessage(r: ChatMessageRow): EventChatMessage {
  return {
    id: r.id,
    senderUsername: r.senderUsername,
    senderName: r.senderName,
    senderColor: r.senderColor,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getRoomMessages(slug: string): Promise<EventChatMessage[]> {
  const key = slug.toLowerCase();
  return withDb(
    async () => {
      // DB modunda seed YOK — gerçek mesajlar (oda boşsa boş döner).
      const rows = await db.chatMessage.findMany({
        where: { eventSlug: key },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(rowToMessage);
    },
    () => getOrCreateRoom(key).messages.slice(),
  );
}

export async function appendRoomMessage(
  slug: string,
  message: EventChatMessage,
): Promise<EventChatMessage> {
  const key = slug.toLowerCase();
  return withDb(
    async () => {
      // id korunur — bus'a publish edilenle aynı mesaj olsun.
      await db.chatMessage.create({
        data: {
          id: message.id,
          eventSlug: key,
          senderUsername: message.senderUsername,
          senderName: message.senderName,
          senderColor: message.senderColor,
          text: message.text,
          createdAt: new Date(message.createdAt),
        },
      });
      return message;
    },
    () => {
      const room = getOrCreateRoom(key);
      room.messages.push(message);
      return message;
    },
  );
}
