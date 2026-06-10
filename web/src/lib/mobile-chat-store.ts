import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

/**
 * Meydate (mobil tanışma) için deviceId-bazlı eşleşme + sohbet katmanı.
 * DirectMessage (web/username) yerine MobileMatch/MobileMessage kullanır.
 * Tüm fonksiyonlar withDb() ile sarılı → tablo yoksa/DB hatasında in-memory'e düşer
 * (prisma db push çalıştırılmadan deploy edilse bile API 500 vermez).
 */

export interface MatchView {
  matchKey: string;
  partnerId: string;
  partnerName: string | null;
  partnerAvatar: string | null;
  lastMessage: string | null;
  lastAt: string | null; // ISO
  unread: number;
  createdAt: string; // ISO
}

export interface MessageView {
  id: string;
  fromMe: boolean;
  text: string;
  at: number; // epoch ms
}

// ── In-memory fallback (globalThis singleton; cold-start'ta sıfırlanır) ──────────
interface MemMatch {
  id: string;
  deviceId: string;
  partnerId: string;
  partnerName: string | null;
  partnerAvatar: string | null;
  matchKey: string;
  createdAt: number;
}
interface MemMessage {
  id: string;
  matchKey: string;
  senderDeviceId: string;
  text: string;
  readAt: number | null;
  createdAt: number;
}
interface MemStore {
  matches: MemMatch[];
  messages: MemMessage[];
}
const g = globalThis as unknown as { __meydateChat?: MemStore };
const mem: MemStore = (g.__meydateChat ??= { matches: [], messages: [] });

let idSeq = 0;
function memId(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSeq}`;
}

/** Gerçek karşılıklı eşleşme için iki cihazdan bağımsız, sıralı stabil oda anahtarı. */
function realMatchKey(a: string, b: string): string {
  return "r_" + [a, b].sort().join("__");
}
/** Mock partnerle (tek taraflı) eşleşme oda anahtarı. */
function mockMatchKey(deviceId: string, partnerId: string): string {
  return "m_" + deviceId + "__" + partnerId;
}

// ── Swipe + (gerçek) eşleşme tespiti ────────────────────────────────────────────

export interface SwipeResult {
  matched: boolean;
  matchKey?: string;
  partner?: { id: string; name: string | null; avatar: string | null };
}

export async function recordSwipe(input: {
  deviceId: string;
  targetId: string;
  targetName?: string | null;
  targetAvatar?: string | null;
  liked: boolean;
}): Promise<SwipeResult> {
  const { deviceId, targetId, liked } = input;
  const targetName = input.targetName ?? null;
  const targetAvatar = input.targetAvatar ?? null;

  return withDb(
    async () => {
      await db.swipe.upsert({
        where: { swiperDeviceId_targetId: { swiperDeviceId: deviceId, targetId } },
        create: { swiperDeviceId: deviceId, targetId, liked },
        update: { liked },
      });
      if (!liked) return { matched: false };

      // Karşı taraf beni beğenmiş mi? (targetId gerçek bir deviceId ise eşleşme olur)
      const reciprocal = await db.swipe.findUnique({
        where: { swiperDeviceId_targetId: { swiperDeviceId: targetId, targetId: deviceId } },
      });
      if (!reciprocal?.liked) return { matched: false };

      const key = realMatchKey(deviceId, targetId);
      // İki taraf için de match satırı (idempotent)
      await db.mobileMatch.upsert({
        where: { deviceId_partnerId: { deviceId, partnerId: targetId } },
        create: { deviceId, partnerId: targetId, partnerName: targetName, partnerAvatar: targetAvatar, matchKey: key },
        update: { matchKey: key },
      });
      await db.mobileMatch.upsert({
        where: { deviceId_partnerId: { deviceId: targetId, partnerId: deviceId } },
        create: { deviceId: targetId, partnerId: deviceId, matchKey: key },
        update: { matchKey: key },
      });
      return { matched: true, matchKey: key, partner: { id: targetId, name: targetName, avatar: targetAvatar } };
    },
    () => {
      const existing = mem.matches.find((m) => m.deviceId === deviceId && m.partnerId === targetId);
      if (existing) existing.partnerName ??= targetName;
      else
        mem.matches.push({
          id: memId("sw"),
          deviceId,
          partnerId: targetId,
          partnerName: targetName,
          partnerAvatar: targetAvatar,
          matchKey: mockMatchKey(deviceId, targetId),
          createdAt: Date.now(),
        });
      if (!liked) return { matched: false };
      const reciprocal = mem.matches.find((m) => m.deviceId === targetId && m.partnerId === deviceId);
      if (!reciprocal) return { matched: false };
      const key = realMatchKey(deviceId, targetId);
      existing && (existing.matchKey = key);
      reciprocal.matchKey = key;
      return { matched: true, matchKey: key, partner: { id: targetId, name: targetName, avatar: targetAvatar } };
    },
  );
}

/** Mock/demo eşleşmesi için konuşma oluştur (idempotent). Client ~%55 roll'unda çağırır. */
export async function ensureMatch(input: {
  deviceId: string;
  partnerId: string;
  partnerName?: string | null;
  partnerAvatar?: string | null;
}): Promise<{ matchKey: string; partner: { id: string; name: string | null; avatar: string | null } }> {
  const { deviceId, partnerId } = input;
  const partnerName = input.partnerName ?? null;
  const partnerAvatar = input.partnerAvatar ?? null;
  const key = mockMatchKey(deviceId, partnerId);

  return withDb(
    async () => {
      await db.mobileMatch.upsert({
        where: { deviceId_partnerId: { deviceId, partnerId } },
        create: { deviceId, partnerId, partnerName, partnerAvatar, matchKey: key },
        update: { partnerName, partnerAvatar },
      });
      return { matchKey: key, partner: { id: partnerId, name: partnerName, avatar: partnerAvatar } };
    },
    () => {
      let m = mem.matches.find((x) => x.deviceId === deviceId && x.partnerId === partnerId);
      if (!m) {
        m = { id: memId("mt"), deviceId, partnerId, partnerName, partnerAvatar, matchKey: key, createdAt: Date.now() };
        mem.matches.push(m);
      } else {
        m.partnerName = partnerName;
        m.partnerAvatar = partnerAvatar;
        m.matchKey = key;
      }
      return { matchKey: key, partner: { id: partnerId, name: partnerName, avatar: partnerAvatar } };
    },
  );
}

export async function listMatches(deviceId: string): Promise<MatchView[]> {
  return withDb(
    async () => {
      const rows = await db.mobileMatch.findMany({ where: { deviceId }, orderBy: { createdAt: "desc" } });
      // Gerçek partner'ların ad/avatarını canlı çöz (eski kayıtlarda name=id, avatar boş olabilir).
      const ids = [...new Set(rows.map((r) => r.partnerId))];
      const [profs, users] = await Promise.all([
        ids.length ? db.mobileProfile.findMany({ where: { deviceId: { in: ids } }, select: { deviceId: true, name: true, avatar: true } }) : [],
        ids.length ? db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, image: true } }) : [],
      ]);
      const profMap = new Map(profs.map((p) => [p.deviceId, p]));
      const userMap = new Map(users.map((u) => [u.id, u]));
      const out: MatchView[] = [];
      for (const r of rows) {
        const last = await db.mobileMessage.findFirst({
          where: { matchKey: r.matchKey },
          orderBy: { createdAt: "desc" },
        });
        const unread = await db.mobileMessage.count({
          where: { matchKey: r.matchKey, senderDeviceId: { not: deviceId }, readAt: null },
        });
        const prof = profMap.get(r.partnerId);
        const usr = userMap.get(r.partnerId);
        // Gerçek ad/avatar varsa onu kullan; yoksa kayıtlı değer (mock kişiler için).
        // Avatar yalnız http(s) ise geçerli — "file://" yerel yolları başka cihazda yüklenmez, ele.
        const httpAvatar = (u: string | null | undefined) => (u && /^https?:\/\//.test(u) ? u : null);
        const realName = prof?.name || usr?.name || null;
        const realAvatar = httpAvatar(prof?.avatar) || httpAvatar(usr?.image) || httpAvatar(r.partnerAvatar) || null;
        // Kayıtlı isim partnerId'nin kendisiyse (eski hata) onu gösterme.
        const storedName = r.partnerName && r.partnerName !== r.partnerId ? r.partnerName : null;
        out.push({
          matchKey: r.matchKey,
          partnerId: r.partnerId,
          partnerName: realName || storedName || "Kullanıcı",
          partnerAvatar: realAvatar, // yalnız geçerli http avatar; yoksa null → mobil fallback üretir
          lastMessage: last?.text ?? null,
          lastAt: last ? last.createdAt.toISOString() : null,
          unread,
          createdAt: r.createdAt.toISOString(),
        });
      }
      return out;
    },
    () => {
      return mem.matches
        .filter((m) => m.deviceId === deviceId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => {
          const msgs = mem.messages.filter((x) => x.matchKey === r.matchKey).sort((a, b) => a.createdAt - b.createdAt);
          const last = msgs[msgs.length - 1];
          const unread = msgs.filter((x) => x.senderDeviceId !== deviceId && x.readAt == null).length;
          return {
            matchKey: r.matchKey,
            partnerId: r.partnerId,
            partnerName: r.partnerName,
            partnerAvatar: r.partnerAvatar,
            lastMessage: last?.text ?? null,
            lastAt: last ? new Date(last.createdAt).toISOString() : null,
            unread,
            createdAt: new Date(r.createdAt).toISOString(),
          };
        });
    },
  );
}

export async function listMessages(input: { matchKey: string; deviceId: string }): Promise<MessageView[]> {
  const { matchKey, deviceId } = input;
  return withDb(
    async () => {
      // Karşı tarafın okunmamışlarını okundu işaretle
      await db.mobileMessage.updateMany({
        where: { matchKey, senderDeviceId: { not: deviceId }, readAt: null },
        data: { readAt: new Date() },
      });
      const rows = await db.mobileMessage.findMany({ where: { matchKey }, orderBy: { createdAt: "asc" } });
      return rows.map((r) => ({
        id: r.id,
        fromMe: r.senderDeviceId === deviceId,
        text: r.text,
        at: r.createdAt.getTime(),
      }));
    },
    () => {
      mem.messages
        .filter((x) => x.matchKey === matchKey && x.senderDeviceId !== deviceId && x.readAt == null)
        .forEach((x) => (x.readAt = Date.now()));
      return mem.messages
        .filter((x) => x.matchKey === matchKey)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((r) => ({ id: r.id, fromMe: r.senderDeviceId === deviceId, text: r.text, at: r.createdAt }));
    },
  );
}

export async function sendMessage(input: {
  matchKey: string;
  senderDeviceId: string;
  text: string;
}): Promise<MessageView> {
  const { matchKey, senderDeviceId } = input;
  const text = input.text.trim().slice(0, 2000);
  return withDb(
    async () => {
      const r = await db.mobileMessage.create({ data: { matchKey, senderDeviceId, text } });
      return { id: r.id, fromMe: true, text: r.text, at: r.createdAt.getTime() };
    },
    () => {
      const r: MemMessage = {
        id: memId("msg"),
        matchKey,
        senderDeviceId,
        text,
        readAt: null,
        createdAt: Date.now(),
      };
      mem.messages.push(r);
      return { id: r.id, fromMe: true, text: r.text, at: r.createdAt };
    },
  );
}

/** Bir konuşmadaki (matchKey) gönderici DIŞINDAKİ gerçek cihaz alıcıları (DM bildirimi için).
 *  Mock eşleşmede tek satır vardır (alıcı = mock partner, gerçek cihaz değil) → boş döner. */
export async function recipientDevicesForMatch(matchKey: string, senderDeviceId: string): Promise<string[]> {
  return withDb(
    async () => {
      const rows = await db.mobileMatch.findMany({ where: { matchKey }, select: { deviceId: true } });
      return [...new Set(rows.map((r) => r.deviceId).filter((d) => d && d !== senderDeviceId))];
    },
    () =>
      [...new Set(mem.matches.filter((m) => m.matchKey === matchKey).map((m) => m.deviceId))].filter(
        (d) => d && d !== senderDeviceId,
      ),
  );
}

/** Gönderenin görünen adı (DM bildirim başlığı için). Yoksa null. */
export async function deviceDisplayName(deviceId: string): Promise<string | null> {
  return withDb(
    async () => (await db.mobileProfile.findUnique({ where: { deviceId }, select: { name: true } }))?.name ?? null,
    () => mem.matches.find((m) => m.partnerId === deviceId)?.partnerName ?? null,
  );
}

// ── Düzenle / Sil (sadece sahibi, gönderimden sonraki 10 dk içinde) ──────────────

/** Mesaj düzenleme/silme için izin verilen pencere. */
export const EDIT_WINDOW_MS = 10 * 60 * 1000;

export type MutationReason = "notfound" | "forbidden" | "expired";
export interface EditResult {
  ok: boolean;
  reason?: MutationReason;
  message?: MessageView;
}
export interface DeleteResult {
  ok: boolean;
  reason?: MutationReason;
}

/**
 * Mesabı bul → sahibini ve 10 dk penceresini doğrula → text'i güncelle.
 * Sonuç ayırt edilebilir: {ok:true,message} | {ok:false,reason:"notfound"|"forbidden"|"expired"}.
 */
export async function editMessage(input: {
  id: string;
  senderDeviceId: string;
  text: string;
}): Promise<EditResult> {
  const { id, senderDeviceId } = input;
  const text = input.text.trim().slice(0, 2000);
  return withDb(
    async () => {
      const existing = await db.mobileMessage.findUnique({ where: { id } });
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.senderDeviceId !== senderDeviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) return { ok: false, reason: "expired" as const };
      const r = await db.mobileMessage.update({ where: { id }, data: { text } });
      return { ok: true, message: { id: r.id, fromMe: true, text: r.text, at: r.createdAt.getTime() } };
    },
    () => {
      const existing = mem.messages.find((x) => x.id === id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.senderDeviceId !== senderDeviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt > EDIT_WINDOW_MS) return { ok: false, reason: "expired" as const };
      existing.text = text;
      return { ok: true, message: { id: existing.id, fromMe: true, text: existing.text, at: existing.createdAt } };
    },
  );
}

/**
 * Mesajı bul → sahibini ve 10 dk penceresini doğrula → sil.
 * Sonuç: {ok:true} | {ok:false,reason:"notfound"|"forbidden"|"expired"}.
 */
export async function deleteMessage(input: {
  id: string;
  senderDeviceId: string;
}): Promise<DeleteResult> {
  const { id, senderDeviceId } = input;
  return withDb(
    async () => {
      const existing = await db.mobileMessage.findUnique({ where: { id } });
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.senderDeviceId !== senderDeviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) return { ok: false, reason: "expired" as const };
      await db.mobileMessage.delete({ where: { id } });
      return { ok: true };
    },
    () => {
      const existing = mem.messages.find((x) => x.id === id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.senderDeviceId !== senderDeviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt > EDIT_WINDOW_MS) return { ok: false, reason: "expired" as const };
      mem.messages = mem.messages.filter((x) => x.id !== id);
      return { ok: true };
    },
  );
}
