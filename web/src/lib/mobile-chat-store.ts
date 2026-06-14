import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";
import { avatarUrlFor } from "./social-data";

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
  // Sohbet listesinde Instagram-tarzı story halkası için: partnerın son 24 saatte
  // story'si var mı + story sahibinin ham deviceId'si (mobil bununla story'leri çeker/açar).
  hasStory?: boolean;
  storyOwnerId?: string | null;
}

export interface MessageView {
  id: string;
  fromMe: boolean;
  text: string;
  at: number; // epoch ms
  readAt: number | null; // karşı taraf okuduysa epoch ms (fromMe mesajlar için mavi tik), yoksa null
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
const g = globalThis as unknown as { __meydateChat?: MemStore; __meydateTyping?: Map<string, number>; __meydatePresence?: Map<string, number> };
const mem: MemStore = (g.__meydateChat ??= { matches: [], messages: [] });

// ── "yazıyor…" efemeral durum (in-memory, TTL'li) ────────────────────────────────
// Anahtar: `${matchKey}|${deviceId}` → son "yazıyor" zaman damgası (ms). Kalıcı değil;
// serverless instance'lar arası best-effort (typing zaten geçici/önemsiz bir sinyal).
const TYPING_TTL_MS = 6000;
const typingMap: Map<string, number> = (g.__meydateTyping ??= new Map());

/** Bu cihazın bir sohbette "yazıyor" olduğunu işaretle (TTL ~6sn). */
export function setTyping(matchKey: string, deviceId: string): void {
  typingMap.set(`${matchKey}|${deviceId}`, Date.now());
}

/** Bu sohbette KARŞI taraf(lar)dan biri son TTL içinde yazıyor mu? */
export function isPartnerTyping(matchKey: string, deviceId: string): boolean {
  const now = Date.now();
  const prefix = `${matchKey}|`;
  for (const [key, ts] of typingMap) {
    if (now - ts > TYPING_TTL_MS) {
      typingMap.delete(key); // fırsatçı temizlik
      continue;
    }
    if (key.startsWith(prefix) && key.slice(prefix.length) !== deviceId) return true;
  }
  return false;
}

// ── Çevrimiçi/son görülme — KALICI (DB; serverless instance'lar arası ortak) ──
// Eskiden in-memory'di → Vercel'de ping ve get farklı instance'lara düşüp durum hiç
// bulunamıyordu ("son görülme" hiç yazmıyordu). Artık MobilePresence tablosunda; tablo
// yoksa withDb otomatik in-memory'e düşer (presenceMap, best-effort fallback).
const ONLINE_WINDOW_MS = 35000; // son 35sn içinde ping → çevrimiçi
interface PresenceEntry {
  ts: number;
  hidden: boolean; // kullanıcı "son görülme/çevrimiçi gizle" açtıysa → karşı taraf göremez
}
const presenceMap: Map<string, PresenceEntry> = (g.__meydatePresence ??= new Map());

/** Bu cihazın "şu an aktif" olduğunu işaretle (kalp atışı). hidden → durumu gizle. */
export async function setPresence(deviceId: string, hidden = false): Promise<void> {
  const identity = await canonicalIdentity(deviceId);
  await withDb(
    async () => {
      await db.mobilePresence.upsert({
        where: { identity },
        create: { identity, lastActiveAt: new Date(), hidden },
        update: { lastActiveAt: new Date(), hidden },
      });
    },
    () => {
      presenceMap.set(identity, { ts: Date.now(), hidden });
    },
  );
}

/** Bir cihazın çevrimiçi durumu + son görülme zamanı (ms). Gizliyse hep çevrimdışı/null. */
export async function getPresence(deviceId: string): Promise<{ online: boolean; lastSeen: number | null }> {
  const identity = await canonicalIdentity(deviceId);
  return withDb(
    async () => {
      const e = await db.mobilePresence.findUnique({ where: { identity } });
      if (!e || e.hidden) return { online: false, lastSeen: null };
      const ts = e.lastActiveAt.getTime();
      return { online: Date.now() - ts < ONLINE_WINDOW_MS, lastSeen: ts };
    },
    () => {
      const e = presenceMap.get(identity);
      if (!e || e.hidden) return { online: false, lastSeen: null };
      return { online: Date.now() - e.ts < ONLINE_WINDOW_MS, lastSeen: e.ts };
    },
  );
}

// ── Engelle / Şikayet ────────────────────────────────────────────────────────────
interface MemBlock { blocker: string; blocked: string }
const g2 = globalThis as unknown as { __meydateBlocks?: MemBlock[] };
const memBlocks: MemBlock[] = (g2.__meydateBlocks ??= []);

/** A, B'yi engelle (kanonik kimlikler). Engelleyenin o konuşması da kaldırılır. */
export async function blockUser(blockerDeviceId: string, blockedId: string): Promise<{ ok: boolean }> {
  const blocker = await canonicalIdentity(blockerDeviceId);
  const blocked = await canonicalIdentity(blockedId);
  if (!blocker || !blocked || blocker === blocked) return { ok: false };
  await withDb(
    async () => {
      await db.mobileBlock.upsert({
        where: { blockerIdentity_blockedIdentity: { blockerIdentity: blocker, blockedIdentity: blocked } },
        create: { blockerIdentity: blocker, blockedIdentity: blocked },
        update: {},
      });
      // Engelleyenin bu kişiyle konuşması listeden kalksın (iki yönlü matchKey satırı).
      await db.mobileMatch.deleteMany({ where: { deviceId: blocker, partnerId: blocked } });
    },
    () => {
      if (!memBlocks.some((b) => b.blocker === blocker && b.blocked === blocked)) memBlocks.push({ blocker, blocked });
      mem.matches = mem.matches.filter((m) => !(m.deviceId === blocker && m.partnerId === blocked));
    },
  );
  return { ok: true };
}

/** İki kimlik arasında (her iki yönde) engelleme var mı? — mesaj iletimini durdurmak için. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const ca = await canonicalIdentity(a);
  const cb = await canonicalIdentity(b);
  if (!ca || !cb) return false;
  return withDb(
    async () => {
      const hit = await db.mobileBlock.findFirst({
        where: {
          OR: [
            { blockerIdentity: ca, blockedIdentity: cb },
            { blockerIdentity: cb, blockedIdentity: ca },
          ],
        },
        select: { id: true },
      });
      return !!hit;
    },
    () => memBlocks.some((x) => (x.blocker === ca && x.blocked === cb) || (x.blocker === cb && x.blocked === ca)),
  );
}

/** Şikayet kaydı oluştur (admin incelemesi için). */
export async function reportUser(input: {
  reporterDeviceId: string;
  reportedId: string;
  reason: string;
  matchKey?: string | null;
}): Promise<{ ok: boolean }> {
  const reporter = await canonicalIdentity(input.reporterDeviceId);
  const reported = await canonicalIdentity(input.reportedId);
  const reason = (input.reason || "").trim().slice(0, 1000) || "Belirtilmedi";
  if (!reporter || !reported) return { ok: false };
  await withDb(
    async () => {
      await db.mobileReport.create({
        data: { reporterIdentity: reporter, reportedIdentity: reported, reason, matchKey: input.matchKey ?? null },
      });
    },
    () => { /* in-memory'de şikayet tutmuyoruz (admin DB'de okur) */ },
  );
  return { ok: true };
}

/** Gerçek matchKey'den iki tarafın kimliğini çıkar ("r_a__b" → [a,b]); değilse null. */
function identitiesFromMatchKey(matchKey: string): [string, string] | null {
  if (!matchKey.startsWith("r_")) return null;
  const parts = matchKey.slice(2).split("__");
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

// ── Admin: şikayet (MobileReport) okuma ──────────────────────────────────────────
export interface ReportRow {
  id: string;
  reporterIdentity: string;
  reporterName: string;
  reportedIdentity: string;
  reportedName: string;
  reason: string;
  matchKey: string | null;
  createdAt: string; // ISO
}

/** Kimlik(ler) → görünen ad eşlemesi (acct:email / cihaz / User.id çözülür). */
async function resolveNames(identities: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(identities.filter(Boolean))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const emailOf = (id: string): string | null =>
    id.startsWith("acct:") ? id.slice(5).toLowerCase() : id.includes("@") ? id.toLowerCase() : null;
  const emails = [...new Set(ids.map(emailOf).filter((e): e is string => !!e))];
  const [profs, users] = await Promise.all([
    db.mobileProfile.findMany({
      where: { OR: [{ deviceId: { in: ids } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
      select: { deviceId: true, email: true, name: true },
    }).catch(() => []),
    db.user.findMany({
      where: { OR: [{ id: { in: ids } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
      select: { id: true, email: true, name: true },
    }).catch(() => []),
  ]);
  const profByDev = new Map(profs.map((p) => [p.deviceId, p.name]));
  const profByEmail = new Map(profs.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.name]));
  const userById = new Map(users.map((u) => [u.id, u.name]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.name]));
  for (const id of ids) {
    const em = emailOf(id);
    const name =
      profByDev.get(id) || userById.get(id) || (em ? profByEmail.get(em) || userByEmail.get(em) : null) || em || id;
    out.set(id, name || id);
  }
  return out;
}

/** Açık (toplam) şikayet sayısı — admin nav rozeti için. */
export async function mobileReportCount(): Promise<number> {
  return withDb(
    () => db.mobileReport.count(),
    () => 0,
  );
}

/** Tüm sohbet şikayetleri (yeni→eski), ad çözümlemeli. */
export async function listMobileReports(limit = 200): Promise<ReportRow[]> {
  return withDb(
    async () => {
      const rows = await db.mobileReport.findMany({ orderBy: { createdAt: "desc" }, take: limit });
      const names = await resolveNames(rows.flatMap((r) => [r.reporterIdentity, r.reportedIdentity]));
      return rows.map((r) => ({
        id: r.id,
        reporterIdentity: r.reporterIdentity,
        reporterName: names.get(r.reporterIdentity) ?? r.reporterIdentity,
        reportedIdentity: r.reportedIdentity,
        reportedName: names.get(r.reportedIdentity) ?? r.reportedIdentity,
        reason: r.reason,
        matchKey: r.matchKey,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    () => [],
  );
}

export interface ReportDetail extends ReportRow {
  messages: { id: string; senderIdentity: string; senderName: string; text: string; at: string; isReported: boolean }[];
}

/** Tek şikayet + (varsa) şikayet edilen konuşmanın TÜM mesajları (admin okusun diye). */
export async function getMobileReport(id: string): Promise<ReportDetail | null> {
  return withDb(
    async () => {
      const r = await db.mobileReport.findUnique({ where: { id } });
      if (!r) return null;
      const names = await resolveNames([r.reporterIdentity, r.reportedIdentity]);
      const base: ReportRow = {
        id: r.id,
        reporterIdentity: r.reporterIdentity,
        reporterName: names.get(r.reporterIdentity) ?? r.reporterIdentity,
        reportedIdentity: r.reportedIdentity,
        reportedName: names.get(r.reportedIdentity) ?? r.reportedIdentity,
        reason: r.reason,
        matchKey: r.matchKey,
        createdAt: r.createdAt.toISOString(),
      };
      let messages: ReportDetail["messages"] = [];
      if (r.matchKey) {
        const msgs = await db.mobileMessage.findMany({
          where: { matchKey: r.matchKey, NOT: { text: { startsWith: "[react]" } } },
          orderBy: { createdAt: "asc" },
          take: 500,
        });
        const msgNames = await resolveNames(msgs.map((m) => m.senderDeviceId));
        messages = msgs.map((m) => ({
          id: m.id,
          senderIdentity: m.senderDeviceId,
          senderName: msgNames.get(m.senderDeviceId) ?? m.senderDeviceId,
          text: m.text,
          at: m.createdAt.toISOString(),
          isReported: m.senderDeviceId === r.reportedIdentity,
        }));
      }
      return { ...base, messages };
    },
    () => null,
  );
}

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

/**
 * Bir kimliği kanonik "acct:<email>" biçimine çevirir.
 * Sistemde aynı kişi 3 farklı kimlikle dolaşabiliyor: acct:email (sohbet/profil),
 * push/@mention deviceId'si ve sosyal gönderi authorId'si (cihaz UUID'si). Bunların
 * hepsi e-postaya çözülürse iki taraf AYNI matchKey'i üretir → mesajlar karşıya ulaşır.
 * E-posta bulunamazsa kimlik aynen döner (mock kişiler vb.).
 */
// Kanonik kimlik cache'i (presence 3sn polling'inde aynı id tekrar tekrar çözülmesin →
// DB yükü). TTL'li, globalThis singleton; nadir değişen bir eşleme.
const CANON_TTL_MS = 5 * 60_000;
const canonCache: Map<string, { v: string; exp: number }> = ((g as unknown as { __meydateCanon?: Map<string, { v: string; exp: number }> }).__meydateCanon ??= new Map());

async function canonicalIdentity(rawId: string): Promise<string> {
  const id = rawId.trim();
  if (!id) return id;
  if (id.startsWith("acct:")) return id.toLowerCase();
  if (id.includes("@")) return `acct:${id.toLowerCase()}`;
  const now = Date.now();
  const hit = canonCache.get(id);
  if (hit && hit.exp > now) return hit.v;
  // Ham User.id veya cihaz UUID'si → e-postaya çöz (User.email veya MobileProfile.email).
  const [usr, prof] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { email: true } }).catch(() => null),
    db.mobileProfile.findUnique({ where: { deviceId: id }, select: { email: true } }).catch(() => null),
  ]);
  const email = usr?.email || prof?.email || null;
  const v = email ? `acct:${email.toLowerCase()}` : id;
  canonCache.set(id, { v, exp: now + CANON_TTL_MS });
  return v;
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
  // Gerçek kullanıcı (hesap kimliği "acct:..." / email) → ÇİFT YÖNLÜ simetrik eşleşme:
  // her iki taraf da konuşmayı listesinde görür. Mock kişide tek yönlü (eski davranış).
  const isReal = partnerId.startsWith("acct:") || partnerId.includes("@") || deviceId.startsWith("acct:");
  const key = isReal ? realMatchKey(deviceId, partnerId) : mockMatchKey(deviceId, partnerId);

  return withDb(
    async () => {
      // Kimlikleri kanonik acct:email'e çöz → iki taraf da AYNI anahtarı üretsin (gönderiden
      // açılan sohbette partner = cihaz UUID'si olsa bile karşı tarafın acct:email satırına denk gelir).
      const cDeviceId = await canonicalIdentity(deviceId);
      const cPartnerId = await canonicalIdentity(partnerId);
      const cIsReal = cPartnerId.startsWith("acct:") || cDeviceId.startsWith("acct:");
      const cKey = cIsReal ? realMatchKey(cDeviceId, cPartnerId) : mockMatchKey(cDeviceId, cPartnerId);
      // Var olan satırın matchKey'ini KORU. Mesajlar matchKey'e bağlı; yeniden hesaplanan
      // anahtarla ezersek mesajlar "yetim" kalır. Bu yüzden mevcut anahtarı kullan.
      const existing = await db.mobileMatch.findUnique({
        where: { deviceId_partnerId: { deviceId: cDeviceId, partnerId: cPartnerId } },
        select: { matchKey: true },
      });
      const finalKey = existing?.matchKey ?? cKey;
      await db.mobileMatch.upsert({
        where: { deviceId_partnerId: { deviceId: cDeviceId, partnerId: cPartnerId } },
        create: { deviceId: cDeviceId, partnerId: cPartnerId, partnerName, partnerAvatar, matchKey: finalKey },
        update: { partnerName, partnerAvatar }, // matchKey'e DOKUNMA
      });
      if (cIsReal) {
        // Karşı taraf için de satır (benim ad/avatarım listMatches'te email'den çözülür).
        await db.mobileMatch.upsert({
          where: { deviceId_partnerId: { deviceId: cPartnerId, partnerId: cDeviceId } },
          create: { deviceId: cPartnerId, partnerId: cDeviceId, matchKey: finalKey },
          update: {}, // var olan ters satırın matchKey'ini de koru
        });
      }
      return { matchKey: finalKey, partner: { id: cPartnerId, name: partnerName, avatar: partnerAvatar } };
    },
    () => {
      let m = mem.matches.find((x) => x.deviceId === deviceId && x.partnerId === partnerId);
      if (!m) {
        m = { id: memId("mt"), deviceId, partnerId, partnerName, partnerAvatar, matchKey: key, createdAt: Date.now() };
        mem.matches.push(m);
      } else {
        m.partnerName = partnerName;
        m.partnerAvatar = partnerAvatar;
        // matchKey KORU — mesajlar buna bağlı (yukarıdaki DB yolundaki açıklama geçerli).
      }
      return { matchKey: m.matchKey, partner: { id: partnerId, name: partnerName, avatar: partnerAvatar } };
    },
  );
}

export async function listMatches(deviceId: string): Promise<MatchView[]> {
  return withDb(
    async () => {
      const rows = await db.mobileMatch.findMany({ where: { deviceId }, orderBy: { createdAt: "desc" } });
      // Gerçek partner'ların ad/avatarını canlı çöz (deviceId / User.id / "acct:email" / email).
      const ids = [...new Set(rows.map((r) => r.partnerId))];
      const emailOf = (id: string): string | null =>
        id.startsWith("acct:") ? id.slice(5).toLowerCase() : id.includes("@") ? id.toLowerCase() : null;
      const emails = [...new Set(ids.map(emailOf).filter((e): e is string => !!e))];
      const [profs, users] = await Promise.all([
        ids.length
          ? db.mobileProfile.findMany({
              where: { OR: [{ deviceId: { in: ids } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
              select: { deviceId: true, email: true, name: true, avatar: true },
            })
          : [],
        ids.length
          ? db.user.findMany({
              where: { OR: [{ id: { in: ids } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
              select: { id: true, email: true, name: true, image: true },
            })
          : [],
      ]);
      const profMap = new Map(profs.map((p) => [p.deviceId, p]));
      const profEmailMap = new Map(profs.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p]));
      const userMap = new Map(users.map((u) => [u.id, u]));
      const userEmailMap = new Map(users.map((u) => [u.email.toLowerCase(), u]));
      const httpAvatar = (u: string | null | undefined) => (u && /^https?:\/\//.test(u) ? u : null);

      // ── Story halkası: partnerların son 24 saatte story'si var mı? ──────────────
      // Story'ler ham deviceId ile saklanır; partner kimliği acct:email olabilir → e-postadan
      // tüm cihaz satırlarını topla, hepsini story sorgusuna kat (kimlik eşleme).
      const profsByEmail = new Map<string, string[]>();
      for (const p of profs) {
        if (!p.email) continue;
        const k = p.email.toLowerCase();
        profsByEmail.set(k, [...(profsByEmail.get(k) ?? []), p.deviceId]);
      }
      const rawDeviceIds = ids.filter((id) => !id.startsWith("acct:") && !id.includes("@"));
      const storyCandidateIds = [...new Set([...profs.map((p) => p.deviceId), ...rawDeviceIds])];
      const storyDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const storyOwnerSet = new Set<string>();
      if (storyCandidateIds.length) {
        const storyRows = await db.mobileStory.findMany({
          where: { deviceId: { in: storyCandidateIds }, createdAt: { gte: storyDayAgo } },
          select: { deviceId: true },
        });
        for (const s of storyRows) storyOwnerSet.add(s.deviceId);
      }
      // Bir partner için story sahibi ham deviceId'yi bul (varsa) — yoksa null.
      const findStoryOwner = (partnerId: string, pEmail: string | null): string | null => {
        const cands = [
          ...(rawDeviceIds.includes(partnerId) ? [partnerId] : []),
          ...(pEmail ? profsByEmail.get(pEmail) ?? [] : []),
          ...(profMap.get(partnerId) ? [partnerId] : []),
        ];
        return cands.find((d) => storyOwnerSet.has(d)) ?? null;
      };
      // Aynı kişi birden çok partner kimliğiyle (acct:email + cihaz UUID; kanonikleştirme
      // öncesi açılmış) iki satır olabilir → AYNI e-postaya çözülenleri TEK girişte birleştir.
      // Okunmamışları topla; temsilci olarak daha güncel mesajlı (eşitse kanonik) odayı seç.
      const lastAtMs = (v: MatchView) => (v.lastAt ? Date.parse(v.lastAt) : 0);
      const isCanonical = (mk: string) => mk.startsWith("r_acct:");
      const byKey = new Map<string, MatchView>();
      for (const r of rows) {
        // Tepki ("[react]...") mesajları gerçek mesaj değil → önizleme & okunmamış sayısına girmez.
        const last = await db.mobileMessage.findFirst({
          where: { matchKey: r.matchKey, NOT: { text: { startsWith: "[react]" } } },
          orderBy: { createdAt: "desc" },
        });
        const unread = await db.mobileMessage.count({
          where: { matchKey: r.matchKey, senderDeviceId: { not: deviceId }, readAt: null, NOT: { text: { startsWith: "[react]" } } },
        });
        const pEmail = emailOf(r.partnerId);
        const prof = profMap.get(r.partnerId) || (pEmail ? profEmailMap.get(pEmail) : undefined);
        const usr = userMap.get(r.partnerId) || (pEmail ? userEmailMap.get(pEmail) : undefined);
        // Gerçek ad/avatar varsa onu kullan; yoksa kayıtlı değer (mock kişiler için).
        const realName = prof?.name || usr?.name || null;
        const realAvatar = httpAvatar(prof?.avatar) || httpAvatar(usr?.image) || httpAvatar(r.partnerAvatar) || null;
        // Kayıtlı isim partnerId'nin kendisiyse (eski hata) onu gösterme.
        const storedName = r.partnerName && r.partnerName !== r.partnerId ? r.partnerName : null;
        const storyOwnerId = findStoryOwner(r.partnerId, pEmail);
        const view: MatchView = {
          matchKey: r.matchKey,
          partnerId: r.partnerId,
          partnerName: realName || storedName || "Kullanıcı",
          partnerAvatar: realAvatar, // yalnız geçerli http avatar; yoksa null → mobil fallback üretir
          lastMessage: last?.text ?? null,
          lastAt: last ? last.createdAt.toISOString() : null,
          unread,
          createdAt: r.createdAt.toISOString(),
          hasStory: !!storyOwnerId,
          storyOwnerId,
        };
        // Birleştirme anahtarı: çözülebilen e-posta (acct:/partnerId/profil/User), yoksa partnerId.
        const groupEmail = pEmail || prof?.email?.toLowerCase() || usr?.email?.toLowerCase() || null;
        const groupKey = groupEmail ? `e:${groupEmail}` : `id:${r.partnerId}`;
        const existing = byKey.get(groupKey);
        if (!existing) {
          byKey.set(groupKey, view);
          continue;
        }
        const rep =
          lastAtMs(view) > lastAtMs(existing) ? view
          : lastAtMs(view) < lastAtMs(existing) ? existing
          : isCanonical(view.matchKey) && !isCanonical(existing.matchKey) ? view
          : existing;
        byKey.set(groupKey, {
          ...rep,
          unread: existing.unread + view.unread, // okunmamış kaybolmasın
          partnerName: existing.partnerName !== "Kullanıcı" ? existing.partnerName : view.partnerName,
          partnerAvatar: existing.partnerAvatar || view.partnerAvatar,
          // Story herhangi bir satırda varsa korunur (iki kimlik satırı birleşince kaybolmasın).
          hasStory: existing.hasStory || view.hasStory,
          storyOwnerId: existing.storyOwnerId || view.storyOwnerId,
        });
      }
      return [...byKey.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
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

/**
 * Bir konuşmayı (matchKey) bu cihazın listesinden siler.
 * - Yalnız bu cihazın match satırını kaldırır (karşı taraf kendi listesini korur).
 * - O matchKey'e bağlı başka match satırı kalmadıysa (mock/tek yönlü) mesajları da temizler.
 */
export async function deleteMatch(input: { deviceId: string; matchKey: string }): Promise<{ ok: boolean }> {
  const { deviceId, matchKey } = input;
  return withDb(
    async () => {
      await db.mobileMatch.deleteMany({ where: { deviceId, matchKey } });
      const remaining = await db.mobileMatch.count({ where: { matchKey } });
      if (remaining === 0) {
        await db.mobileMessage.deleteMany({ where: { matchKey } });
      }
      return { ok: true };
    },
    () => {
      mem.matches = mem.matches.filter((m) => !(m.deviceId === deviceId && m.matchKey === matchKey));
      const remaining = mem.matches.filter((m) => m.matchKey === matchKey).length;
      if (remaining === 0) {
        mem.messages = mem.messages.filter((x) => x.matchKey !== matchKey);
      }
      return { ok: true };
    },
  );
}

/**
 * Bu cihazın TÜM konuşmalarındaki okunmamış (karşı taraftan gelen) mesajları okundu işaretler.
 * Sohbet balonundaki toplam rozeti sıfırlar. Etkilenen mesaj sayısını döner.
 */
export async function markAllRead(deviceId: string): Promise<{ ok: boolean; count: number }> {
  return withDb(
    async () => {
      const rows = await db.mobileMatch.findMany({ where: { deviceId }, select: { matchKey: true } });
      const keys = [...new Set(rows.map((r) => r.matchKey))];
      if (keys.length === 0) return { ok: true, count: 0 };
      const res = await db.mobileMessage.updateMany({
        where: { matchKey: { in: keys }, senderDeviceId: { not: deviceId }, readAt: null },
        data: { readAt: new Date() },
      });
      return { ok: true, count: res.count };
    },
    () => {
      const keys = new Set(mem.matches.filter((m) => m.deviceId === deviceId).map((m) => m.matchKey));
      let count = 0;
      for (const x of mem.messages) {
        if (keys.has(x.matchKey) && x.senderDeviceId !== deviceId && x.readAt == null) {
          x.readAt = Date.now();
          count += 1;
        }
      }
      return { ok: true, count };
    },
  );
}

/** YALNIZ bir konuşmadaki (matchKey) karşı taraftan gelen okunmamışları okundu işaretler. */
export async function markMatchRead(deviceId: string, matchKey: string): Promise<{ ok: boolean; count: number }> {
  return withDb(
    async () => {
      const res = await db.mobileMessage.updateMany({
        where: { matchKey, senderDeviceId: { not: deviceId }, readAt: null },
        data: { readAt: new Date() },
      });
      return { ok: true, count: res.count };
    },
    () => {
      let count = 0;
      for (const x of mem.messages) {
        if (x.matchKey === matchKey && x.senderDeviceId !== deviceId && x.readAt == null) {
          x.readAt = Date.now();
          count += 1;
        }
      }
      return { ok: true, count };
    },
  );
}

export async function listMessages(input: {
  matchKey: string;
  deviceId: string;
  limit?: number; // sayfa boyutu (varsayılan 20)
  before?: number; // verilirse bu epoch ms'den ÖNCEKİ mesajlar (eski sayfa / yukarı kaydırma)
  skipRead?: boolean; // "okundu bilgisini gizle" → karşı tarafa okundu (readAt) yazma
}): Promise<MessageView[]> {
  const { matchKey, deviceId } = input;
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const before = input.before && input.before > 0 ? input.before : null;
  return withDb(
    async () => {
      // Okundu işaretleme YALNIZ canlı (en yeni) sayfada — eski sayfa yüklerken dokunma.
      // skipRead → kullanıcı "okundu bilgisini gizle" açmış, readAt yazılmaz.
      if (!before && !input.skipRead) {
        await db.mobileMessage.updateMany({
          where: { matchKey, senderDeviceId: { not: deviceId }, readAt: null },
          data: { readAt: new Date() },
        });
      }
      // En yeni `limit` mesajı (veya before'dan öncekini) desc çek, sonra asc'e çevir.
      const rows = await db.mobileMessage.findMany({
        where: { matchKey, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows
        .reverse()
        .map((r) => ({
          id: r.id,
          fromMe: r.senderDeviceId === deviceId,
          text: r.text,
          at: r.createdAt.getTime(),
          readAt: r.readAt ? r.readAt.getTime() : null,
        }));
    },
    () => {
      if (!before && !input.skipRead) {
        mem.messages
          .filter((x) => x.matchKey === matchKey && x.senderDeviceId !== deviceId && x.readAt == null)
          .forEach((x) => (x.readAt = Date.now()));
      }
      const all = mem.messages
        .filter((x) => x.matchKey === matchKey && (before ? x.createdAt < before : true))
        .sort((a, b) => a.createdAt - b.createdAt);
      return all
        .slice(Math.max(0, all.length - limit)) // son `limit`
        .map((r) => ({ id: r.id, fromMe: r.senderDeviceId === deviceId, text: r.text, at: r.createdAt, readAt: r.readAt ?? null }));
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
  // Engelli çift → mesajı İLETME (kalıcılaştırma yok). Gönderene sahte başarı dön ki akış
  // bozulmasın; mesaj karşı tarafa ulaşmaz (shadow-block).
  const ids = identitiesFromMatchKey(matchKey);
  if (ids && (await isBlockedBetween(ids[0], ids[1]))) {
    return { id: memId("blocked"), fromMe: true, text, at: Date.now(), readAt: null };
  }
  return withDb(
    async () => {
      const r = await db.mobileMessage.create({ data: { matchKey, senderDeviceId, text } });
      return { id: r.id, fromMe: true, text: r.text, at: r.createdAt.getTime(), readAt: null };
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
      return { id: r.id, fromMe: true, text: r.text, at: r.createdAt, readAt: null };
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
    async () => {
      // Önce doğrudan profil; bulunamazsa e-postadan (acct:email/@) User.name veya MobileProfile.name'e çöz.
      // → DM push başlığı "Yeni mesaj" yerine GERÇEK gönderen adı olur (WhatsApp gibi: kimden + mesaj).
      const direct = await db.mobileProfile.findUnique({ where: { deviceId }, select: { name: true } });
      if (direct?.name) return direct.name;
      const email = deviceId.startsWith("acct:")
        ? deviceId.slice(5).toLowerCase()
        : deviceId.includes("@")
          ? deviceId.toLowerCase()
          : null;
      if (email) {
        const [usr, prof] = await Promise.all([
          db.user.findFirst({ where: { email }, select: { name: true } }).catch(() => null),
          db.mobileProfile.findFirst({ where: { email }, select: { name: true } }).catch(() => null),
        ]);
        return usr?.name || prof?.name || null;
      }
      return null;
    },
    () => mem.matches.find((m) => m.partnerId === deviceId)?.partnerName ?? null,
  );
}

/**
 * Cihazın push/Bildirim avatarı (Instagram tarzı sağdaki kişi resmi). Öncelik:
 *   1) kişinin YÜKLEDİĞİ foto (MobileProfile.avatar — Google foto override'ı)
 *   2) GMAIL fotosu (User.image — Google girişinden)
 *   3) ada göre üretilen VARSAYILAN portre
 * Her zaman bir görsel döner (default dahil) → push'ta resim hep olur.
 */
export async function deviceAvatar(deviceId: string): Promise<string | null> {
  const httpAvatar = (u: string | null | undefined) => (u && /^https?:\/\//.test(u) ? u : null);
  return withDb(
    async () => {
      const direct = await db.mobileProfile.findUnique({
        where: { deviceId },
        select: { avatar: true, name: true, email: true },
      });
      let uploaded = httpAvatar(direct?.avatar);
      let gmail: string | null = null;
      let name = direct?.name ?? null;
      const email = deviceId.startsWith("acct:")
        ? deviceId.slice(5).toLowerCase()
        : deviceId.includes("@")
          ? deviceId.toLowerCase()
          : direct?.email?.toLowerCase() ?? null;
      if (email && (!uploaded || !name)) {
        const [usr, prof] = await Promise.all([
          db.user.findFirst({ where: { email }, select: { image: true, name: true } }).catch(() => null),
          db.mobileProfile.findFirst({ where: { email }, select: { avatar: true, name: true } }).catch(() => null),
        ]);
        uploaded = uploaded || httpAvatar(prof?.avatar);
        gmail = httpAvatar(usr?.image);
        name = name || prof?.name || usr?.name || null;
      }
      // Öncelik: yüklenen > Gmail > varsayılan (ada göre).
      return uploaded || gmail || (name ? avatarUrlFor(name) : null);
    },
    () => {
      const m = mem.matches.find((x) => x.partnerId === deviceId);
      return httpAvatar(m?.partnerAvatar);
    },
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
      return { ok: true, message: { id: r.id, fromMe: true, text: r.text, at: r.createdAt.getTime(), readAt: r.readAt ? r.readAt.getTime() : null } };
    },
    () => {
      const existing = mem.messages.find((x) => x.id === id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.senderDeviceId !== senderDeviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt > EDIT_WINDOW_MS) return { ok: false, reason: "expired" as const };
      existing.text = text;
      return { ok: true, message: { id: existing.id, fromMe: true, text: existing.text, at: existing.createdAt, readAt: existing.readAt ?? null } };
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
