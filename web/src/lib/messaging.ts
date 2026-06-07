import {
  type Conversation,
  type Message,
  CURRENT_USERNAME,
  SEED_CONVERSATIONS,
} from "./messaging-data";
import { getBlockedUsernames } from "./safety-actions";
import { db } from "./db";
import { withDb } from "./db-fallback";

// In-memory store. Persists for the lifetime of the dev server process.
// DB modunda (isDbConfigured) mesajlar Prisma'ya yazılır; tablo yoksa / DB
// hatası olursa withDb() bu in-memory mantığına düşer. Canlı SSE bus'ı
// (messaging-bus.ts) bu dosyadan bağımsızdır — ona dokunulmaz.
const store = new Map<string, Conversation>();

function ensureSeeded() {
  if (store.size === 0) {
    for (const c of SEED_CONVERSATIONS) {
      // Deep clone messages so mutations don't leak into the seed
      store.set(c.username, {
        username: c.username,
        unreadCount: c.unreadCount,
        lastMessage: { ...c.lastMessage },
        messages: c.messages.map((m) => ({ ...m })),
      });
    }
  }
}

function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function recomputeMeta(c: Conversation): Conversation {
  const sorted = sortMessages(c.messages);
  const lastMessage = sorted[sorted.length - 1] ?? c.lastMessage;
  const unreadCount = sorted.filter(
    (m) => m.senderUsername !== CURRENT_USERNAME && !m.readAt,
  ).length;
  return { ...c, messages: sorted, lastMessage, unreadCount };
}

// -----------------------------------------------------------------------------
// DB satırı → Message (readAt null → undefined)
// -----------------------------------------------------------------------------
interface DirectMessageRow {
  id: string;
  partnerUsername: string;
  senderUsername: string;
  text: string;
  readAt: Date | null;
  createdAt: Date;
}

function rowToMessage(r: DirectMessageRow): Message {
  return {
    id: r.id,
    senderUsername: r.senderUsername,
    text: r.text,
    createdAt: r.createdAt,
    readAt: r.readAt ?? undefined,
  };
}

/** DB satırlarını partnerUsername'e göre gruplayıp Conversation listesine çevirir. */
function rowsToConversations(rows: DirectMessageRow[]): Conversation[] {
  const grouped = new Map<string, Message[]>();
  for (const r of rows) {
    const u = r.partnerUsername.toLowerCase();
    const list = grouped.get(u) ?? [];
    list.push(rowToMessage(r));
    grouped.set(u, list);
  }
  const out: Conversation[] = [];
  for (const [username, messages] of grouped.entries()) {
    const sorted = sortMessages(messages);
    const lastMessage = sorted[sorted.length - 1];
    const unreadCount = sorted.filter(
      (m) => m.senderUsername !== CURRENT_USERNAME && !m.readAt,
    ).length;
    out.push({ username, lastMessage, unreadCount, messages: sorted });
  }
  return out;
}

export async function getConversations(): Promise<Conversation[]> {
  const blocked = await getBlockedUsernames();
  return withDb(
    async () => {
      const rows = await db.directMessage.findMany({
        orderBy: { createdAt: "asc" },
      });
      return rowsToConversations(rows)
        .filter((c) => !blocked.has(c.username))
        .sort(
          (a, b) =>
            b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime(),
        );
    },
    () => {
      ensureSeeded();
      return Array.from(store.values())
        .filter((c) => !blocked.has(c.username))
        .map(recomputeMeta)
        .sort(
          (a, b) =>
            b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime(),
        );
    },
  );
}

export async function getConversation(
  username: string,
): Promise<Conversation | null> {
  const u = username.toLowerCase();
  const blocked = await getBlockedUsernames();
  if (blocked.has(u)) return null;
  return withDb(
    async () => {
      const rows = await db.directMessage.findMany({
        where: { partnerUsername: u },
        orderBy: { createdAt: "asc" },
      });
      if (rows.length === 0) return null;
      const convs = rowsToConversations(rows);
      return convs[0] ?? null;
    },
    () => {
      ensureSeeded();
      const c = store.get(u);
      if (!c) return null;
      return recomputeMeta(c);
    },
  );
}

export async function getUnreadCount(): Promise<number> {
  const blocked = await getBlockedUsernames();
  return withDb(
    async () => {
      const rows = await db.directMessage.findMany({
        where: { senderUsername: { not: CURRENT_USERNAME }, readAt: null },
        select: { partnerUsername: true },
      });
      let total = 0;
      for (const r of rows) {
        if (blocked.has(r.partnerUsername.toLowerCase())) continue;
        total += 1;
      }
      return total;
    },
    () => {
      ensureSeeded();
      let total = 0;
      for (const c of store.values()) {
        if (blocked.has(c.username)) continue;
        for (const m of c.messages) {
          if (m.senderUsername !== CURRENT_USERNAME && !m.readAt) total += 1;
        }
      }
      return total;
    },
  );
}

// --- mutations used by chat page ---

export async function ensureConversation(username: string): Promise<Conversation> {
  const u = username.toLowerCase();
  return withDb(
    async () => {
      // DB modunda no-op create: mevcut mesajlardan Conversation kur, yoksa boş döndür.
      const existing = await getConversation(u);
      if (existing) return existing;
      const placeholder: Message = {
        id: `${u}-init`,
        senderUsername: CURRENT_USERNAME,
        text: "",
        createdAt: new Date(),
      };
      return {
        username: u,
        unreadCount: 0,
        lastMessage: placeholder,
        messages: [],
      };
    },
    () => {
      ensureSeeded();
      const existing = store.get(u);
      if (existing) return existing;
      const placeholder: Message = {
        id: `${u}-init`,
        senderUsername: CURRENT_USERNAME,
        text: "",
        createdAt: new Date(),
      };
      const fresh: Conversation = {
        username: u,
        unreadCount: 0,
        lastMessage: placeholder,
        messages: [],
      };
      store.set(u, fresh);
      return fresh;
    },
  );
}

export async function appendMessage(
  username: string,
  text: string,
  senderUsername: string = CURRENT_USERNAME,
): Promise<Message> {
  const u = username.toLowerCase();
  return withDb(
    async () => {
      const row = await db.directMessage.create({
        data: {
          partnerUsername: u,
          senderUsername,
          text,
          readAt: senderUsername === CURRENT_USERNAME ? new Date() : null,
        },
      });
      return rowToMessage(row);
    },
    () => {
      ensureSeeded();
      let c = store.get(u);
      if (!c) {
        c = {
          username: u,
          unreadCount: 0,
          lastMessage: {
            id: `${u}-init`,
            senderUsername: CURRENT_USERNAME,
            text: "",
            createdAt: new Date(),
          },
          messages: [],
        };
        store.set(u, c);
      }
      const msg: Message = {
        id: `${u}-m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderUsername,
        text,
        createdAt: new Date(),
        readAt: senderUsername === CURRENT_USERNAME ? new Date() : undefined,
      };
      c.messages.push(msg);
      c.lastMessage = msg;
      c.unreadCount = c.messages.filter(
        (m) => m.senderUsername !== CURRENT_USERNAME && !m.readAt,
      ).length;
      return msg;
    },
  );
}

export async function markConversationRead(username: string): Promise<void> {
  const u = username.toLowerCase();
  await withDb(
    async () => {
      await db.directMessage.updateMany({
        where: {
          partnerUsername: u,
          senderUsername: { not: CURRENT_USERNAME },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    },
    () => {
      const c = store.get(u);
      if (!c) return;
      const now = new Date();
      for (const m of c.messages) {
        if (m.senderUsername !== CURRENT_USERNAME && !m.readAt) m.readAt = now;
      }
      c.unreadCount = 0;
    },
  );
}
