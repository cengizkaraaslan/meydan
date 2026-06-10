import "server-only";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import type { EventCategory } from "./types";
import { withDb } from "./db-fallback";
import { db } from "./db";

export interface StoredSubscription {
  userId: string;
  subscription: WebPushSubscription;
  categories: EventCategory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// In-memory store: userId -> StoredSubscription
// (DB yapılandırılmamışsa / DB hatasında fallback — withDb ile. DB modunda
//  abonelikler Prisma'ya gider → serverless örnekler arası paylaşılır + restart'ta kalıcı.)
const SUBSCRIPTIONS = new Map<string, StoredSubscription>();
// Sekonder index: endpoint -> userId, hızlı unsubscribe için
const ENDPOINT_INDEX = new Map<string, string>();

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@etkinlikscout.local";
  if (!publicKey || !privateKey) {
    console.warn("[push-server] VAPID anahtarları eksik (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Push gönderilemeyecek.");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

// -----------------------------------------------------------------------------
// DB satırı → StoredSubscription. WebPushSubscription'ı endpoint + keys'ten
// yeniden kurar (DB'de düz alanlar olarak saklanıyor).
// -----------------------------------------------------------------------------
interface PushSubscriptionRow {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  categories: string[];
  createdAt: Date;
  updatedAt: Date;
}

function rowToStored(r: PushSubscriptionRow): StoredSubscription {
  return {
    userId: r.userId,
    subscription: {
      endpoint: r.endpoint,
      keys: { p256dh: r.p256dh, auth: r.auth },
    } as WebPushSubscription,
    categories: r.categories as EventCategory[],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// -----------------------------------------------------------------------------
// In-memory yardımcıları (withDb memFn) — eski mantık AYNEN.
// -----------------------------------------------------------------------------
function saveSubscriptionMem(
  subscription: WebPushSubscription,
  categories: EventCategory[],
  userId: string,
): StoredSubscription {
  const now = new Date();
  const existing = SUBSCRIPTIONS.get(userId);
  const record: StoredSubscription = {
    userId,
    subscription,
    categories,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  SUBSCRIPTIONS.set(userId, record);
  ENDPOINT_INDEX.set(subscription.endpoint, userId);
  return record;
}

function removeSubscriptionMem(endpoint: string): boolean {
  const userId = ENDPOINT_INDEX.get(endpoint);
  if (!userId) return false;
  SUBSCRIPTIONS.delete(userId);
  ENDPOINT_INDEX.delete(endpoint);
  return true;
}

function getSubscribersMem(category?: EventCategory): StoredSubscription[] {
  const all = Array.from(SUBSCRIPTIONS.values());
  if (!category) return all;
  return all.filter((s) => s.categories.length === 0 || s.categories.includes(category));
}

function getSubscriberCountMem(): number {
  return SUBSCRIPTIONS.size;
}

// -----------------------------------------------------------------------------
// Hibrit dışa açık API — DB varsa Prisma, yoksa in-memory'e düşer.
// -----------------------------------------------------------------------------
export async function saveSubscription(
  subscription: WebPushSubscription,
  categories: EventCategory[],
  userId: string = "demo-user",
): Promise<StoredSubscription> {
  return withDb(
    async () => {
      const row = await db.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          categories,
        },
        update: {
          userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          categories,
        },
      });
      return rowToStored(row);
    },
    () => saveSubscriptionMem(subscription, categories, userId),
  );
}

export async function removeSubscription(endpoint: string): Promise<boolean> {
  return withDb(
    async () => {
      const res = await db.pushSubscription.deleteMany({ where: { endpoint } });
      return res.count > 0;
    },
    () => removeSubscriptionMem(endpoint),
  );
}

export async function getSubscribers(category?: EventCategory): Promise<StoredSubscription[]> {
  return withDb(
    async () => {
      const rows = await db.pushSubscription.findMany();
      const stored = rows.map(rowToStored);
      if (!category) return stored;
      // categories boş (= tümüne abone) VEYA kategoriyi içerenler
      return stored.filter((s) => s.categories.length === 0 || s.categories.includes(category));
    },
    () => getSubscribersMem(category),
  );
}

export async function getSubscriberCount(): Promise<number> {
  return withDb(
    () => db.pushSubscription.count(),
    () => getSubscriberCountMem(),
  );
}

export interface SendResult {
  endpoint: string;
  ok: boolean;
  statusCode?: number;
  error?: string;
}

// Verilen aboneliklere paralel gönder (410/404 → temizle). sendPush + sendPushToUserIds ortak.
async function deliver(targets: StoredSubscription[], payload: PushPayload): Promise<SendResult[]> {
  const body = JSON.stringify(payload);
  return Promise.all(
    targets.map(async (t): Promise<SendResult> => {
      try {
        const res = await webpush.sendNotification(t.subscription, body);
        return { endpoint: t.subscription.endpoint, ok: true, statusCode: res.statusCode };
      } catch (err: unknown) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        // 410 Gone / 404 Not Found → subscription expired, temizle
        if (e.statusCode === 410 || e.statusCode === 404) {
          await removeSubscription(t.subscription.endpoint);
        }
        return {
          endpoint: t.subscription.endpoint,
          ok: false,
          statusCode: e.statusCode,
          error: e.body || e.message || "unknown",
        };
      }
    }),
  );
}

export async function sendPush(
  category: EventCategory | null,
  payload: PushPayload,
): Promise<SendResult[]> {
  if (!configureVapid()) return [];
  const targets = await getSubscribers(category ?? undefined);
  return deliver(targets, payload);
}

/** Belirli kullanıcı(lar)ın tüm tarayıcı aboneliklerine hedefli push (@mention için). */
export async function sendPushToUserIds(
  userIds: string[],
  payload: PushPayload,
): Promise<SendResult[]> {
  if (!configureVapid() || userIds.length === 0) return [];
  const ids = new Set(userIds);
  const targets = await withDb(
    async () => {
      const rows = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
      return rows.map(rowToStored);
    },
    () => Array.from(SUBSCRIPTIONS.values()).filter((s) => ids.has(s.userId)),
  );
  return deliver(targets, payload);
}
