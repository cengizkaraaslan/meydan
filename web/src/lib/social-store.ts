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

export async function listFeed(input: { deviceId: string; filter: "all" | "follow" }): Promise<FeedPost[]> {
  if (!isDbConfigured) return [];
  const { deviceId, filter } = input;

  let where: Record<string, unknown> = {};
  if (filter === "follow") {
    const ids = await listFollowingIds(deviceId);
    // Kendi gönderilerini + takip ettiklerini göster.
    where = { authorId: { in: [...ids, deviceId] } };
  }

  const posts = await db.mobilePost.findMany({ where, orderBy: { createdAt: "desc" }, take: 60 });
  if (posts.length === 0) return [];
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

export async function follow(input: { followerDeviceId: string; followingId: string; actorName?: string | null }) {
  const { followerDeviceId, followingId } = input;
  if (followerDeviceId === followingId) return { following: true, followsBack: false };
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
