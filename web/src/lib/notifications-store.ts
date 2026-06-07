import "server-only";
import { withDb } from "./db-fallback";
import { db } from "./db";

export type NotificationType =
  | "message"
  | "comment_reply"
  | "comment_like"
  | "rsvp_reminder"
  | "new_follower"
  | "event_update"
  | "report_resolved"
  | "system";

export interface Notification {
  id: string;
  userEmail: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Tıklanınca gidilecek URL */
  url: string;
  /** ISO */
  createdAt: string;
  read: boolean;
  /** Opsiyonel: sender (DM/comment için) */
  fromName?: string;
  fromColor?: string;
}

interface NotifStoreShape {
  byUser: Map<string, Notification[]>;
}

const g = globalThis as unknown as { __notifStore?: NotifStoreShape };
g.__notifStore ??= { byUser: new Map() };
const store = g.__notifStore;

const MAX_PER_USER = 50;

function ensure(user: string): Notification[] {
  let list = store.byUser.get(user);
  if (!list) {
    list = seedFor(user);
    store.byUser.set(user, list);
  }
  return list;
}

function seedFor(user: string): Notification[] {
  const now = Date.now();
  return [
    {
      id: `nseed-${user}-1`,
      userEmail: user,
      type: "system",
      title: "MeydanFest'e hoş geldin",
      body: "Etkinlikleri keşfet, arkadaşlarınla buluş.",
      url: "/etkinlikler",
      createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
      read: false,
    },
  ];
}

// -----------------------------------------------------------------------------
// DB satırı → Notification. type union'a cast'lenir (DB'de String tutulur),
// fromName/fromColor null → undefined.
// -----------------------------------------------------------------------------
interface NotificationRow {
  id: string;
  userEmail: string;
  type: string;
  title: string;
  body: string;
  url: string;
  read: boolean;
  fromName: string | null;
  fromColor: string | null;
  createdAt: Date;
}

function rowToNotification(r: NotificationRow): Notification {
  return {
    id: r.id,
    userEmail: r.userEmail,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    url: r.url,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
    fromName: r.fromName ?? undefined,
    fromColor: r.fromColor ?? undefined,
  };
}

export async function listNotifications(user: string, limit = 20): Promise<Notification[]> {
  return withDb(
    async () => {
      const rows = await db.notification.findMany({
        where: { userEmail: user },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(rowToNotification);
    },
    () => {
      const list = ensure(user);
      return list
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
  );
}

export async function unreadCount(user: string): Promise<number> {
  return withDb(
    () => db.notification.count({ where: { userEmail: user, read: false } }),
    () => ensure(user).filter((n) => !n.read).length,
  );
}

export async function pushNotification(
  input: Omit<Notification, "id" | "createdAt" | "read">,
): Promise<Notification> {
  return withDb(
    async () => {
      const row = await db.notification.create({
        data: {
          userEmail: input.userEmail,
          type: input.type,
          title: input.title,
          body: input.body,
          url: input.url,
          fromName: input.fromName ?? null,
          fromColor: input.fromColor ?? null,
        },
      });
      // FIFO cap: kullanıcının 50'den fazlası varsa en eskileri sil.
      const ids = await db.notification.findMany({
        where: { userEmail: input.userEmail },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (ids.length > MAX_PER_USER) {
        const toDelete = ids.slice(MAX_PER_USER).map((x) => x.id);
        await db.notification.deleteMany({ where: { id: { in: toDelete } } });
      }
      return rowToNotification(row);
    },
    () => {
      const list = ensure(input.userEmail);
      const n: Notification = {
        ...input,
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      list.push(n);
      // FIFO cap
      if (list.length > MAX_PER_USER) {
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        list.splice(0, list.length - MAX_PER_USER);
      }
      return n;
    },
  );
}

export async function markRead(user: string, id: string): Promise<boolean> {
  return withDb(
    async () => {
      const res = await db.notification.updateMany({
        where: { id, userEmail: user },
        data: { read: true },
      });
      return res.count > 0;
    },
    () => {
      const list = ensure(user);
      const n = list.find((x) => x.id === id);
      if (!n) return false;
      n.read = true;
      return true;
    },
  );
}

export async function markAllRead(user: string): Promise<number> {
  return withDb(
    async () => {
      const res = await db.notification.updateMany({
        where: { userEmail: user, read: false },
        data: { read: true },
      });
      return res.count;
    },
    () => {
      const list = ensure(user);
      let count = 0;
      for (const n of list) {
        if (!n.read) {
          n.read = true;
          count++;
        }
      }
      return count;
    },
  );
}

export async function removeNotification(user: string, id: string): Promise<boolean> {
  return withDb(
    async () => {
      const res = await db.notification.deleteMany({ where: { id, userEmail: user } });
      return res.count > 0;
    },
    () => {
      const list = ensure(user);
      const idx = list.findIndex((n) => n.id === id);
      if (idx < 0) return false;
      list.splice(idx, 1);
      return true;
    },
  );
}
