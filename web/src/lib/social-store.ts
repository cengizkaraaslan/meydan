import "server-only";
import { db, isDbConfigured } from "./db";

/** Meydan duvarı veri katmanı — deviceId bazlı sosyal graf + gönderi/tepki/yorum/bildirim. */

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  text: string | null;
  imageUrl: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  createdAt: string;
  reactions: Record<string, number>; // emoji -> sayı
  reactionTotal: number;
  myReaction: string | null;
  commentCount: number;
}

export async function listFollowingIds(deviceId: string): Promise<string[]> {
  if (!isDbConfigured) return [];
  const rows = await db.follow.findMany({ where: { followerDeviceId: deviceId }, select: { followingId: true } });
  return rows.map((r) => r.followingId);
}

const PAGE = 20;

export async function listFeed(input: { deviceId: string; filter: "all" | "follow"; offset?: number }): Promise<FeedPost[]> {
  if (!isDbConfigured) return [];
  const { deviceId, filter } = input;
  const offset = Math.max(0, input.offset ?? 0);

  let where: Record<string, unknown> = {};
  if (filter === "follow") {
    const ids = await listFollowingIds(deviceId);
    // Kendi gönderilerin + takip ettiklerin + Sistem (etkinlik duyuruları her zaman görünür).
    where = { authorId: { in: [...ids, deviceId, "system"] } };
  }

  let posts = await db.mobilePost.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: PAGE });
  if (posts.length === 0) return [];

  // Sistem (etkinlik) gönderilerinden, eventSlug'ı db.event'te karşılığı OLMAYAN ya da
  // etkinliği GEÇMİŞTE kalmış olanları ele. Üniversite idari duyuruları ("…Ele Alındı",
  // "…Düzenlendi") geçmiş tarihli haberlerdir — gerçek (gelecek) etkinlik değiller;
  // ayrıca canlı API mock/snapshot modunda bunların slug'ını çözemediği için detayda
  // "Etkinliğe git → bulunamadı" veriyorlardı. Yalnız GELECEK etkinliklerin sistem
  // gönderileri akışta kalsın.
  const sysSlugs = [
    ...new Set(
      posts
        .filter((p) => p.authorId === "system" && p.eventSlug)
        .map((p) => p.eventSlug as string),
    ),
  ];
  if (sysSlugs.length > 0) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const existing = await db.event.findMany({
      where: { slug: { in: sysSlugs }, startsAt: { gte: todayStart } },
      select: { slug: true },
    });
    const liveSlugs = new Set(existing.map((e) => e.slug));
    posts = posts.filter(
      (p) => p.authorId !== "system" || !p.eventSlug || liveSlugs.has(p.eventSlug),
    );
    if (posts.length === 0) return [];
  }

  const ids = posts.map((p) => p.id);

  const [reacts, myReacts, comments] = await Promise.all([
    db.postReaction.groupBy({ by: ["postId", "emoji"], where: { postId: { in: ids } }, _count: { _all: true } }),
    db.postReaction.findMany({ where: { postId: { in: ids }, deviceId } }),
    db.postComment.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
  ]);

  const reactionMap = new Map<string, Record<string, number>>();
  for (const r of reacts) {
    const m = reactionMap.get(r.postId) ?? {};
    m[r.emoji] = r._count._all;
    reactionMap.set(r.postId, m);
  }
  const mine = new Map(myReacts.map((r) => [r.postId, r.emoji]));
  const commentMap = new Map(comments.map((c) => [c.postId, c._count._all]));

  return posts.map((p) => {
    const reactions = reactionMap.get(p.id) ?? {};
    return {
      id: p.id,
      authorId: p.authorId,
      authorName: p.authorName,
      authorAvatar: p.authorAvatar,
      text: p.text,
      imageUrl: p.imageUrl,
      eventSlug: p.eventSlug,
      eventTitle: p.eventTitle,
      createdAt: p.createdAt.toISOString(),
      reactions,
      reactionTotal: Object.values(reactions).reduce((a, b) => a + b, 0),
      myReaction: mine.get(p.id) ?? null,
      commentCount: commentMap.get(p.id) ?? 0,
    };
  });
}

export async function createPost(input: {
  authorId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  eventSlug?: string | null;
  eventTitle?: string | null;
}) {
  return db.mobilePost.create({
    data: {
      authorId: input.authorId,
      authorName: input.authorName ?? null,
      authorAvatar: input.authorAvatar ?? null,
      text: input.text ?? null,
      imageUrl: input.imageUrl ?? null,
      eventSlug: input.eventSlug ?? null,
      eventTitle: input.eventTitle ?? null,
    },
  });
}

export const POST_EDIT_WINDOW_MS = 10 * 60 * 1000;
export type PostMutReason = "notfound" | "forbidden" | "expired";

/** Kendi gönderini 10 dk içinde düzenle. */
export async function editPost(input: { id: string; authorId: string; text: string }): Promise<{ ok: boolean; reason?: PostMutReason }> {
  const p = await db.mobilePost.findUnique({ where: { id: input.id } });
  if (!p) return { ok: false, reason: "notfound" };
  if (p.authorId !== input.authorId || p.authorId === "system") return { ok: false, reason: "forbidden" };
  if (Date.now() - p.createdAt.getTime() > POST_EDIT_WINDOW_MS) return { ok: false, reason: "expired" };
  await db.mobilePost.update({ where: { id: input.id }, data: { text: input.text.slice(0, 2000) } });
  return { ok: true };
}

/** Kendi gönderini 10 dk içinde sil (tepki + yorumlarıyla). */
export async function deletePost(input: { id: string; authorId: string }): Promise<{ ok: boolean; reason?: PostMutReason }> {
  const p = await db.mobilePost.findUnique({ where: { id: input.id } });
  if (!p) return { ok: false, reason: "notfound" };
  if (p.authorId !== input.authorId || p.authorId === "system") return { ok: false, reason: "forbidden" };
  if (Date.now() - p.createdAt.getTime() > POST_EDIT_WINDOW_MS) return { ok: false, reason: "expired" };
  await db.postReaction.deleteMany({ where: { postId: input.id } });
  await db.postComment.deleteMany({ where: { postId: input.id } });
  await db.mobilePost.delete({ where: { id: input.id } });
  return { ok: true };
}

export async function follow(input: { followerDeviceId: string; followingId: string; actorName?: string | null }) {
  const { followerDeviceId, followingId } = input;
  // Sistem (etkinlik duyuru hesabı) takip edilemez.
  if (followingId === "system" || followerDeviceId === followingId) return { following: false, followsBack: false };
  await db.follow.upsert({
    where: { followerDeviceId_followingId: { followerDeviceId, followingId } },
    create: { followerDeviceId, followingId },
    update: {},
  });
  // Hedefe bildirim (geri takip etsin diye).
  await db.mobileNotif.create({
    data: { deviceId: followingId, type: "follow", actorId: followerDeviceId, actorName: input.actorName ?? null },
  });
  const back = await db.follow.findUnique({
    where: { followerDeviceId_followingId: { followerDeviceId: followingId, followingId: followerDeviceId } },
  });
  return { following: true, followsBack: !!back };
}

export async function unfollow(input: { followerDeviceId: string; followingId: string }) {
  await db.follow
    .delete({ where: { followerDeviceId_followingId: input } })
    .catch(() => null);
  return { following: false };
}

export async function reactToPost(input: { postId: string; deviceId: string; emoji: string }) {
  const { postId, deviceId, emoji } = input;
  const existing = await db.postReaction.findUnique({ where: { postId_deviceId: { postId, deviceId } } });
  if (existing && existing.emoji === emoji) {
    await db.postReaction.delete({ where: { postId_deviceId: { postId, deviceId } } });
    return { myReaction: null };
  }
  await db.postReaction.upsert({
    where: { postId_deviceId: { postId, deviceId } },
    create: { postId, deviceId, emoji },
    update: { emoji },
  });
  return { myReaction: emoji };
}

export async function listComments(postId: string) {
  if (!isDbConfigured) return [];
  const rows = await db.postComment.findMany({ where: { postId }, orderBy: { createdAt: "asc" } });
  return rows.map((c) => ({
    id: c.id,
    deviceId: c.deviceId,
    authorName: c.authorName,
    text: c.text,
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function addComment(input: { postId: string; deviceId: string; authorName?: string | null; text: string }) {
  const c = await db.postComment.create({
    data: { postId: input.postId, deviceId: input.deviceId, authorName: input.authorName ?? null, text: input.text.slice(0, 1000) },
  });
  return { id: c.id, deviceId: c.deviceId, authorName: c.authorName, text: c.text, createdAt: c.createdAt.toISOString() };
}

export async function listNotifs(deviceId: string) {
  if (!isDbConfigured) return [];
  const rows = await db.mobileNotif.findMany({ where: { deviceId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    actorId: n.actorId,
    actorName: n.actorName,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotifsRead(deviceId: string) {
  await db.mobileNotif.updateMany({ where: { deviceId, read: false }, data: { read: true } });
  return { ok: true };
}

// ─── Sistem (etkinlik) gönderileri ───────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  KONSER: "konser", FESTIVAL: "festival", TIYATRO: "tiyatro", STANDUP: "stand-up",
  SPOR: "spor", SERGI: "sergi", ATOLYE: "atölye", COCUK: "çocuk", FUAR: "fuar", DIGER: "etkinlik",
};

export interface SystemEventInput {
  slug: string;
  title: string;
  city: string;
  category: string;
  imageUrl?: string | null;
  startsAt?: Date | string | null;
}

function systemPostText(e: SystemEventInput): string {
  const label = CAT_LABEL[e.category] ?? "etkinlik";
  if (e.category === "DIGER") return `${e.title} hakkında ${e.city}'de yeni bir etkinlik oluşturuldu 🎉`;
  return `${e.title} hakkında ${e.city}'de ${label} alanında yeni bir etkinlik oluşturuldu 🎉`;
}

/**
 * Verilen etkinlikler için "Sistem" gönderileri oluşturur (eventSlug ile idempotent —
 * zaten gönderisi olan etkinlik atlanır). Scrape sonrası + seed için kullanılır.
 */
export async function syncSystemPostsForEvents(events: SystemEventInput[]): Promise<number> {
  if (!isDbConfigured || events.length === 0) return 0;
  // Yalnız GELECEK etkinlikler için sistem gönderisi üret — geçmiş tarihli üniversite
  // idari duyuruları ("…Ele Alındı" vb.) akışı kirletmesin (startsAt verilmişse).
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  events = events.filter((e) => {
    if (e.startsAt == null) return true;
    const ms = typeof e.startsAt === "string" ? Date.parse(e.startsAt) : e.startsAt.getTime();
    return Number.isNaN(ms) || ms >= todayStart.getTime();
  });
  const slugs = events.map((e) => e.slug).filter(Boolean);
  if (slugs.length === 0) return 0;
  try {
    const existing = await db.mobilePost.findMany({
      where: { authorId: "system", eventSlug: { in: slugs } },
      select: { eventSlug: true },
    });
    const have = new Set(existing.map((x) => x.eventSlug));
    const fresh = events.filter((e) => e.slug && !have.has(e.slug));
    if (fresh.length === 0) return 0;
    await db.mobilePost.createMany({
      data: fresh.map((e) => ({
        authorId: "system",
        authorName: "Sistem",
        authorAvatar: null,
        text: systemPostText(e),
        imageUrl: e.imageUrl ?? null,
        eventSlug: e.slug,
        eventTitle: e.title,
      })),
    });
    return fresh.length;
  } catch (err) {
    console.warn("[social] syncSystemPostsForEvents başarısız:", err instanceof Error ? err.message : err);
    return 0;
  }
}

// ─── Mobil story'ler (deviceId bazlı, R2 görsel) ─────────────────────────────
export interface MobileStoryView {
  id: string;
  deviceId: string;
  name: string | null;
  avatar: string | null;
  imageUrl: string;
  caption: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  createdAt: string;
}

function toStoryView(s: {
  id: string; deviceId: string; name: string | null; avatar: string | null;
  imageUrl: string; caption: string | null; eventSlug: string | null; eventTitle: string | null; createdAt: Date;
}): MobileStoryView {
  return {
    id: s.id, deviceId: s.deviceId, name: s.name, avatar: s.avatar, imageUrl: s.imageUrl,
    caption: s.caption, eventSlug: s.eventSlug, eventTitle: s.eventTitle, createdAt: s.createdAt.toISOString(),
  };
}

/** Bir veya birden çok deviceId'nin story'lerini döner (yeni→eski). */
export async function listMobileStories(deviceIds: string[]): Promise<MobileStoryView[]> {
  if (!isDbConfigured || deviceIds.length === 0) return [];
  const rows = await db.mobileStory.findMany({
    where: { deviceId: { in: deviceIds } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toStoryView);
}

export async function createMobileStory(input: {
  deviceId: string; imageUrl: string; caption?: string | null;
  eventSlug?: string | null; eventTitle?: string | null; name?: string | null; avatar?: string | null;
}): Promise<MobileStoryView> {
  const s = await db.mobileStory.create({
    data: {
      deviceId: input.deviceId, imageUrl: input.imageUrl,
      caption: input.caption ?? null, eventSlug: input.eventSlug ?? null, eventTitle: input.eventTitle ?? null,
      name: input.name ?? null, avatar: input.avatar ?? null,
    },
  });
  return toStoryView(s);
}

export interface MobileStoryViewer {
  id: string; // viewerId (deviceId / acct anahtarı)
  name: string | null;
  avatar: string | null;
  viewedAt: string;
}

/** Story görüntülenmesini kaydet (Instagram "seen by"). Sahip kendi story'sini izlemez. */
export async function markMobileStoryViewed(storyId: string, viewerId: string): Promise<{ ok: boolean }> {
  if (!isDbConfigured || !storyId || !viewerId) return { ok: false };
  const s = await db.mobileStory.findUnique({ where: { id: storyId }, select: { deviceId: true } });
  if (!s) return { ok: false };
  if (s.deviceId === viewerId) return { ok: true }; // kendi story'm — sayma
  await db.mobileStoryView.upsert({
    where: { storyId_viewerId: { storyId, viewerId } },
    create: { storyId, viewerId },
    update: {},
  });
  return { ok: true };
}

/** Bir story'i kimler gördü + toplam (yeni→eski). Ad/avatar MobileProfile'dan (gerçek data). */
export async function listMobileStoryViewers(
  storyId: string,
): Promise<{ count: number; viewers: MobileStoryViewer[] }> {
  if (!isDbConfigured || !storyId) return { count: 0, viewers: [] };
  const views = await db.mobileStoryView.findMany({
    where: { storyId },
    orderBy: { viewedAt: "desc" },
    take: 500,
  });
  const ids = [...new Set(views.map((v) => v.viewerId))];
  const profs = ids.length
    ? await db.mobileProfile.findMany({ where: { deviceId: { in: ids } }, select: { deviceId: true, name: true, avatar: true } })
    : [];
  const pmap = new Map(profs.map((p) => [p.deviceId, p]));
  const viewers: MobileStoryViewer[] = views.map((v) => {
    const p = pmap.get(v.viewerId);
    return { id: v.viewerId, name: p?.name ?? null, avatar: p?.avatar ?? null, viewedAt: v.viewedAt.toISOString() };
  });
  return { count: viewers.length, viewers };
}

/** Kendi story'ni sil (deviceId sahiplik kontrolü). */
export async function deleteMobileStory(input: { id: string; deviceId: string }): Promise<{ ok: boolean }> {
  const s = await db.mobileStory.findUnique({ where: { id: input.id } });
  if (!s || s.deviceId !== input.deviceId) return { ok: false };
  await db.mobileStory.delete({ where: { id: input.id } });
  return { ok: true };
}

/** Kendi story'nin başlığını/caption'ını güncelle (deviceId sahiplik). */
export async function updateMobileStory(input: { id: string; deviceId: string; caption: string }): Promise<{ ok: boolean }> {
  const s = await db.mobileStory.findUnique({ where: { id: input.id } });
  if (!s || s.deviceId !== input.deviceId) return { ok: false };
  await db.mobileStory.update({ where: { id: input.id }, data: { caption: input.caption.slice(0, 300) } });
  return { ok: true };
}
