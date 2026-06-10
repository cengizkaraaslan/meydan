import "server-only";
import { db, isDbConfigured } from "./db";
import { sendExpoPush, type ExpoPushMessage } from "./expo-push";
import { sendPushToUserIds } from "./push-server";

/**
 * @mention çözümleme + çift dağıtım (mobil Expo push + web tarayıcı web-push).
 * Metindeki "@email" geçişleri çıkarılır; o email'e ait mobil cihaz(lar)a ve web
 * kullanıcı aboneliklerine bildirim gider. Hepsi best-effort (hata yutulur).
 */

// "@ad@site.com" → email yakala. Önündeki @ mention işareti, grup içi gerçek email.
const MENTION_RE = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export function extractMentionEmails(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

export interface NotifyPayload {
  title: string;
  body: string;
  /** Tıklayınca açılacak deep-link verisi (mobil) ve url (web). */
  data?: Record<string, unknown>;
}

/** Kısa önizleme metni (Instagram tarzı) — bildirim gövdesi için. */
export function preview(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// Mobil tarafa Expo push at + geçersiz token'ları temizle.
async function pushToDevices(
  rows: { deviceId: string; pushToken: string | null }[],
  payload: NotifyPayload,
): Promise<void> {
  const messages: ExpoPushMessage[] = rows
    .filter((r) => r.pushToken)
    .map((r) => ({ to: r.pushToken as string, title: payload.title, body: payload.body, data: payload.data }));
  if (messages.length === 0) return;
  const { invalidTokens } = await sendExpoPush(messages);
  if (invalidTokens.length) {
    await db.mobileProfile
      .updateMany({ where: { pushToken: { in: invalidTokens } }, data: { pushToken: null } })
      .catch(() => {});
  }
}

/**
 * Verilen email'lere bildir: mobil (email eşleşen + token'lı profiller) + web
 * (email → User.id → tarayıcı abonelikleri).
 */
export async function notifyEmails(emails: string[], payload: NotifyPayload): Promise<void> {
  const list = [...new Set(emails.map((e) => e.toLowerCase()))].filter(Boolean);
  if (list.length === 0 || !isDbConfigured) return;

  // Mobil
  try {
    const profiles = await db.mobileProfile.findMany({
      where: { email: { in: list }, pushToken: { not: null } },
      select: { deviceId: true, pushToken: true },
    });
    await pushToDevices(profiles, payload);
  } catch (e) {
    console.warn("[mention-notify] mobil push hata:", e instanceof Error ? e.message : e);
  }

  // Web (tarayıcı)
  try {
    const users = await db.user.findMany({ where: { email: { in: list } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      const url = typeof payload.data?.url === "string" ? (payload.data.url as string) : undefined;
      await sendPushToUserIds(ids, { title: payload.title, body: payload.body, url });
    }
  } catch (e) {
    console.warn("[mention-notify] web push hata:", e instanceof Error ? e.message : e);
  }
}

/**
 * Belirli cihaz(lar)a doğrudan bildir (email gerektirmez) — DM'de alıcıya önizlemeli
 * bildirim için. Bot/sistem göndericileri arayan tarafından elenir.
 */
export async function notifyDevices(deviceIds: string[], payload: NotifyPayload): Promise<void> {
  const list = [...new Set(deviceIds)].filter(Boolean);
  if (list.length === 0 || !isDbConfigured) return;
  try {
    const profiles = await db.mobileProfile.findMany({
      where: { deviceId: { in: list }, pushToken: { not: null } },
      select: { deviceId: true, pushToken: true },
    });
    await pushToDevices(profiles, payload);
  } catch (e) {
    console.warn("[mention-notify] cihaz push hata:", e instanceof Error ? e.message : e);
  }
}
