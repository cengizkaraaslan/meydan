import { API_BASE } from "./api";
import { getOrCreateDeviceId } from "./device";

/** Meydan sosyal duvar API istemcisi (deviceId bazlı). */

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

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
  reactions: Record<string, number>;
  reactionTotal: number;
  myReaction: string | null;
  commentCount: number;
}

export interface PostComment {
  id: string;
  deviceId: string;
  authorName: string | null;
  text: string;
  createdAt: string;
}

export interface SocialNotif {
  id: string;
  type: string;
  actorId: string;
  actorName: string | null;
  read: boolean;
  createdAt: string;
}

/** Mock kişi id'si (u1..) → duvardaki yazar id'si (fake_u1). Gerçek deviceId aynen kalır. */
export function followIdForPerson(personId: string): string {
  return /^u\d+$/.test(personId) ? `fake_${personId}` : personId;
}

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function send<T>(method: string, path: string, body: unknown, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function fetchFeed(filter: "all" | "follow"): Promise<FeedPost[]> {
  const deviceId = await getOrCreateDeviceId();
  const r = await getJson<{ data?: FeedPost[] }>(`/api/v1/social/feed?deviceId=${encodeURIComponent(deviceId)}&filter=${filter}`, {});
  return r.data ?? [];
}

export async function createPost(input: {
  text?: string;
  imageUrl?: string;
  eventSlug?: string;
  eventTitle?: string;
  authorName?: string;
  authorAvatar?: string;
}): Promise<boolean> {
  const authorId = await getOrCreateDeviceId();
  const r = await send<{ ok?: boolean }>("POST", "/api/v1/social/feed", { authorId, ...input }, {});
  return !!r.ok;
}

export async function fetchFollowing(): Promise<string[]> {
  const deviceId = await getOrCreateDeviceId();
  const r = await getJson<{ following?: string[] }>(`/api/v1/social/follow?deviceId=${encodeURIComponent(deviceId)}`, {});
  return r.following ?? [];
}

export async function followUser(followingId: string, actorName?: string): Promise<{ following: boolean; followsBack: boolean }> {
  const followerDeviceId = await getOrCreateDeviceId();
  return send("POST", "/api/v1/social/follow", { followerDeviceId, followingId, actorName }, { following: false, followsBack: false });
}

export async function unfollowUser(followingId: string): Promise<{ following: boolean }> {
  const followerDeviceId = await getOrCreateDeviceId();
  return send("DELETE", "/api/v1/social/follow", { followerDeviceId, followingId }, { following: true });
}

export async function reactPost(postId: string, emoji: string): Promise<string | null> {
  const deviceId = await getOrCreateDeviceId();
  const r = await send<{ myReaction?: string | null }>("POST", "/api/v1/social/react", { postId, deviceId, emoji }, {});
  return r.myReaction ?? null;
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const r = await getJson<{ data?: PostComment[] }>(`/api/v1/social/comments?postId=${encodeURIComponent(postId)}`, {});
  return r.data ?? [];
}

export async function addComment(postId: string, text: string, authorName?: string): Promise<PostComment | null> {
  const deviceId = await getOrCreateDeviceId();
  const r = await send<{ comment?: PostComment }>("POST", "/api/v1/social/comments", { postId, deviceId, authorName, text }, {});
  return r.comment ?? null;
}

export async function fetchNotifs(): Promise<{ data: SocialNotif[]; unread: number }> {
  const deviceId = await getOrCreateDeviceId();
  const r = await getJson<{ data?: SocialNotif[]; unread?: number }>(`/api/v1/social/notifs?deviceId=${encodeURIComponent(deviceId)}`, {});
  return { data: r.data ?? [], unread: r.unread ?? 0 };
}

export async function markNotifsRead(): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await send("POST", "/api/v1/social/notifs", { deviceId }, {});
}
