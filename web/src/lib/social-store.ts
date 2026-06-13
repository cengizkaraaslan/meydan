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
    // SADECE takip ettiklerin + kendi gönderilerin. Sistem (etkinlik duyuruları) bu sekmede
    // GÖSTERİLMEZ; yalnız "Genel" akışta serpiştirilir. ("system" bilinçli olarak hariç.)
    where = { authorId: { in: [...ids, deviceId] } };
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
  // Yorum tepkilerini de temizle (gönderinin yorumlarına ait).
  const cids = (await db.postComment.findMany({ where: { postId: input.id }, select: { id: true } })).map((c) => c.id);
  if (cids.length) await db.postCommentReaction.deleteMany({ where: { commentId: { in: cids } } });
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

export interface PostCommentReplyTo {
  id: string;
  authorName: string | null;
  snippet: string;
}
export interface PostCommentView {
  id: string;
  deviceId: string;
  authorName: string | null;
  text: string;
  replyTo: PostCommentReplyTo | null; // bu yorum bir yanıtsa alıntı özeti
  reactions: Record<string, number>; // emoji -> sayı
  reactionTotal: number;
  myReaction: string | null;
  replyCount: number;
  createdAt: string;
}

/** Alıntı önizleme metni (boşluk sadeleştir, ~80 karakter). */
function commentSnippet(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 80 ? t.slice(0, 80) + "…" : t;
}

/** Etkileşime göre azalan sırala; eşitlikte yeni üstte (Instagram "en popüler yorum"). */
function sortByCommentEngagement(views: PostCommentView[]): PostCommentView[] {
  return views.sort((a, b) => {
    const sb = b.reactionTotal + b.replyCount;
    const sa = a.reactionTotal + a.replyCount;
    if (sb !== sa) return sb - sa;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function listComments(postId: string, viewerDeviceId = ""): Promise<PostCommentView[]> {
  if (!isDbConfigured) return [];
  const rows = await db.postComment.findMany({ where: { postId }, orderBy: { createdAt: "asc" } });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const [grouped, mine] = await Promise.all([
    db.postCommentReaction.groupBy({ by: ["commentId", "emoji"], where: { commentId: { in: ids } }, _count: { _all: true } }),
    viewerDeviceId
      ? db.postCommentReaction.findMany({ where: { commentId: { in: ids }, deviceId: viewerDeviceId } })
      : Promise.resolve([] as { commentId: string; emoji: string }[]),
  ]);
  const reactionMap = new Map<string, Record<string, number>>();
  const totalMap = new Map<string, number>();
  for (const grp of grouped) {
    const m = reactionMap.get(grp.commentId) ?? {};
    m[grp.emoji] = grp._count._all;
    reactionMap.set(grp.commentId, m);
    totalMap.set(grp.commentId, (totalMap.get(grp.commentId) ?? 0) + grp._count._all);
  }
  const myMap = new Map(mine.map((r) => [r.commentId, r.emoji]));
  const replyCountMap = new Map<string, number>();
  for (const r of rows) if (r.replyToId) replyCountMap.set(r.replyToId, (replyCountMap.get(r.replyToId) ?? 0) + 1);

  const views: PostCommentView[] = rows.map((c) => {
    const target = c.replyToId ? byId.get(c.replyToId) : null;
    return {
      id: c.id,
      deviceId: c.deviceId,
      authorName: c.authorName,
      text: c.text,
      replyTo: target ? { id: target.id, authorName: target.authorName, snippet: commentSnippet(target.text) } : null,
      reactions: reactionMap.get(c.id) ?? {},
      reactionTotal: totalMap.get(c.id) ?? 0,
      myReaction: myMap.get(c.id) ?? null,
      replyCount: replyCountMap.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    };
  });
  return sortByCommentEngagement(views);
}

export async function addComment(input: {
  postId: string;
  deviceId: string;
  authorName?: string | null;
  text: string;
  replyToId?: string | null;
}): Promise<PostCommentView> {
  const replyToId = input.replyToId ?? null;
  const c = await db.postComment.create({
    data: { postId: input.postId, deviceId: input.deviceId, authorName: input.authorName ?? null, text: input.text.slice(0, 1000), replyToId },
  });
  let replyTo: PostCommentReplyTo | null = null;
  if (replyToId) {
    const t = await db.postComment.findUnique({ where: { id: replyToId } });
    if (t) replyTo = { id: t.id, authorName: t.authorName, snippet: commentSnippet(t.text) };
  }
  return {
    id: c.id,
    deviceId: c.deviceId,
    authorName: c.authorName,
    text: c.text,
    replyTo,
    reactions: {},
    reactionTotal: 0,
    myReaction: null,
    replyCount: 0,
    createdAt: c.createdAt.toISOString(),
  };
}

/** Yanıtlanan yorumun sahibinin deviceId'si (reply bildirimi için). Yoksa null. */
export async function postCommentReplyTargetOwner(replyToId: string): Promise<string | null> {
  if (!isDbConfigured) return null;
  const t = await db.postComment.findUnique({ where: { id: replyToId }, select: { deviceId: true } });
  return t?.deviceId ?? null;
}

/** Bir feed yorumuna emoji tepki ekle/değiştir/kaldır (kişi başına tek; aynı emoji tekrar → kaldırır). */
export async function reactToPostComment(input: { commentId: string; deviceId: string; emoji: string }) {
  const { commentId, deviceId, emoji } = input;
  const existing = await db.postCommentReaction.findUnique({ where: { commentId_deviceId: { commentId, deviceId } } });
  if (existing && existing.emoji === emoji) {
    await db.postCommentReaction.delete({ where: { commentId_deviceId: { commentId, deviceId } } });
    return { myReaction: null };
  }
  await db.postCommentReaction.upsert({
    where: { commentId_deviceId: { commentId, deviceId } },
    create: { commentId, deviceId, emoji },
    update: { emoji },
  });
  return { myReaction: emoji };
}

export async function listNotifs(deviceId: string) {
  if (!isDbConfigured) return [];
  const rows = await db.mobileNotif.findMany({ where: { deviceId }, orderBy: { createdAt: "desc" }, take: 50 });
  // Aktör avatarını canlı çöz (deviceId / acct:email / User.id / email) → bildirimde gerçek foto görünsün.
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))];
  const emailOf = (id: string): string | null =>
    id.startsWith("acct:") ? id.slice(5).toLowerCase() : id.includes("@") ? id.toLowerCase() : null;
  const emails = [...new Set(actorIds.map(emailOf).filter((e): e is string => !!e))];
  const [profs, users] = await Promise.all([
    actorIds.length
      ? db.mobileProfile.findMany({
          where: { OR: [{ deviceId: { in: actorIds } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
          select: { deviceId: true, email: true, avatar: true, name: true },
        })
      : [],
    actorIds.length
      ? db.user.findMany({
          where: { OR: [{ id: { in: actorIds } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
          select: { id: true, email: true, image: true, name: true },
        })
      : [],
  ]);
  const profById = new Map(profs.map((p) => [p.deviceId, p]));
  const profByEmail = new Map(profs.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const pick = (actorId: string) => {
    const e = emailOf(actorId);
    const prof = profById.get(actorId) || (e ? profByEmail.get(e) : undefined);
    const usr = userById.get(actorId) || (e ? userByEmail.get(e) : undefined);
    return { prof, usr };
  };
  const httpAvatar = (u: string | null | undefined) => (u && /^https?:\/\//.test(u) ? u : null);
  return rows.map((n) => {
    const { prof, usr } = pick(n.actorId);
    // Bildirimde gerçek ad + avatarı göster (kayıtlı değer zayıfsa canlı çözümle).
    const resolvedName = prof?.name || usr?.name || null;
    const resolvedAvatar = httpAvatar(prof?.avatar) || httpAvatar(usr?.image) || null;
    return {
    id: n.id,
    type: n.type,
    actorId: n.actorId,
    actorName: resolvedName || n.actorName,
    actorAvatar: resolvedAvatar,
    body: n.body ?? null,
    target: n.target ?? null,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    };
  });
}

/** Uygulama-içi bildirim ekle (mention/yorum/mesaj vb. → Bildirimler listesine düşer). */
export async function addMobileNotif(input: {
  deviceId: string; // alıcı (acct:<email> veya cihaz id)
  type: string;
  actorId?: string | null;
  actorName?: string | null;
  body?: string | null;
  target?: string | null;
}): Promise<void> {
  if (!isDbConfigured) return;
  try {
    await db.mobileNotif.create({
      data: {
        deviceId: input.deviceId,
        type: input.type,
        actorId: input.actorId ?? "",
        actorName: input.actorName ?? null,
        body: input.body ?? null,
        target: input.target ?? null,
      },
    });
  } catch {
    /* best-effort */
  }
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
