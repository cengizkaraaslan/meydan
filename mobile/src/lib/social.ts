import * as FileSystem from "expo-file-system/legacy";
import { API_BASE } from "./api";
import { getOrCreateDeviceId } from "./device";
import { getProfileKey } from "./profileSync";

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
  body?: string | null;
  target?: string | null;
  read: boolean;
  createdAt: string;
}

/** Mock kişi id'si (u1..) → duvardaki yazar id'si (fake_u1). Gerçek deviceId aynen kalır. */
export function followIdForPerson(personId: string): string {
  return /^u\d+$/.test(personId) ? `fake_${personId}` : personId;
}

// ── Gerçek kullanıcı verisi (profil ekranı için — mock değil) ────────────────
export interface UserStats {
  attended: number;
  comments: number;
  photos: number;
  stories: number;
  following: number;
  followers: number;
  reactions: number;
}

/** Bir kullanıcının GERÇEK toplam sayıları (katılım/yorum/foto/story/takip/tepki). */
export async function fetchUserStats(deviceId: string): Promise<UserStats> {
  const empty: UserStats = { attended: 0, comments: 0, photos: 0, stories: 0, following: 0, followers: 0, reactions: 0 };
  const r = await getJson<{ stats?: UserStats }>(
    `/api/v1/social/user-stats?deviceId=${encodeURIComponent(deviceId)}`,
    {},
  );
  return r.stats ?? empty;
}

export interface PublicProfile {
  name?: string | null;
  avatar?: string | null;
  bio?: string | null;
  city?: string | null;
  district?: string | null;
  birthDate?: string | null;
  interests?: string | null;
  gender?: string | null;
}

/** Bir deviceId'nin GERÇEK profilini çek (ad/avatar/bio/şehir/yaş/ilgi). */
export async function fetchProfileById(deviceId: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/profile?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: { "x-api-key": "meydanfest-app", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { profile?: PublicProfile | null };
    return json.profile ?? null;
  } catch {
    return null;
  }
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

export const FEED_PAGE = 20;

export async function fetchFeed(filter: "all" | "follow", offset = 0): Promise<FeedPost[]> {
  const deviceId = await getOrCreateDeviceId();
  const r = await getJson<{ data?: FeedPost[] }>(
    `/api/v1/social/feed?deviceId=${encodeURIComponent(deviceId)}&filter=${filter}&offset=${offset}`,
    {},
  );
  return r.data ?? [];
}

/** Kendi gönderini 10 dk içinde düzenle. */
export async function editPost(id: string, text: string): Promise<{ ok: boolean; reason?: string }> {
  const authorId = await getOrCreateDeviceId();
  return send("PATCH", "/api/v1/social/feed", { id, authorId, text }, { ok: false, reason: "network" });
}

/** Kendi gönderini 10 dk içinde sil. */
export async function deletePost(id: string): Promise<{ ok: boolean; reason?: string }> {
  const authorId = await getOrCreateDeviceId();
  return send("DELETE", "/api/v1/social/feed", { id, authorId }, { ok: false, reason: "network" });
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
  // Hesap-bazlı kimlik (acct:<email>) → mention/yorum/mesaj bildirimleri girişli hesapta görünür.
  const deviceId = await getProfileKey();
  const r = await getJson<{ data?: SocialNotif[]; unread?: number }>(`/api/v1/social/notifs?deviceId=${encodeURIComponent(deviceId)}`, {});
  return { data: r.data ?? [], unread: r.unread ?? 0 };
}

export async function markNotifsRead(): Promise<void> {
  const deviceId = await getProfileKey();
  await send("POST", "/api/v1/social/notifs", { deviceId }, {});
}

// ─── Görsel yükleme (R2) + DB story ──────────────────────────────────────────
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

function guessType(uri: string): { type: string; ext: string } {
  const u = uri.toLowerCase();
  if (u.endsWith(".png")) return { type: "image/png", ext: "png" };
  if (u.endsWith(".webp")) return { type: "image/webp", ext: "webp" };
  if (u.endsWith(".gif")) return { type: "image/gif", ext: "gif" };
  return { type: "image/jpeg", ext: "jpg" };
}

/**
 * Yerel görseli R2'ye yükler. Başarıda { url }, hatada { error } (sunucunun gerçek
 * mesajı: "Geçersiz tür", "Dosya 6MB...", "Yüklenemedi: ...", bağlantı hatası vb.).
 */
export async function uploadImageResult(
  uri: string,
  kind: "story" | "post" = "post",
): Promise<{ url: string } | { error: string }> {
  try {
    const { type } = guessType(uri);
    // RN'de fetch+FormData {uri,name,type} bu sürümde "Unsupported FormDataPart
    // implementation" hatası veriyor → expo-file-system uploadAsync (dosyadan multipart).
    const res = await FileSystem.uploadAsync(`${API_BASE}/api/v1/social/upload`, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: type,
      parameters: { kind },
    });
    let data: { ok?: boolean; url?: string; error?: string } | null = null;
    try {
      data = JSON.parse(res.body) as { ok?: boolean; url?: string; error?: string };
    } catch {
      /* gövde JSON değil */
    }
    if (res.status < 200 || res.status >= 300 || !data?.ok || !data?.url) {
      return { error: data?.error ? String(data.error) : `Sunucu hatası (HTTP ${res.status})` };
    }
    // publicUrl göreli (/api/r2-image/...) dönebilir → mobilde render için mutlak yap.
    return { url: data.url.startsWith("http") ? data.url : `${API_BASE}${data.url}` };
  } catch (e) {
    return { error: e instanceof Error ? `Bağlantı hatası: ${e.message}` : "Bağlantı hatası" };
  }
}

/** Yerel görseli R2'ye yükler, public URL döner (başarısızsa null). kind: "story"|"post". */
export async function uploadImage(uri: string, kind: "story" | "post" = "post"): Promise<string | null> {
  const r = await uploadImageResult(uri, kind);
  return "url" in r ? r.url : null;
}

export async function createStory(input: {
  imageUrl: string; caption?: string; eventSlug?: string; eventTitle?: string; name?: string; avatar?: string;
}): Promise<MobileStoryView | null> {
  const deviceId = await getOrCreateDeviceId();
  const r = await send<{ ok?: boolean; story?: MobileStoryView }>("POST", "/api/v1/social/stories", { deviceId, ...input }, {});
  return r.story ?? null;
}

export async function fetchMyStories(): Promise<MobileStoryView[]> {
  const deviceId = await getOrCreateDeviceId();
  const r = await getJson<{ data?: MobileStoryView[] }>(`/api/v1/social/stories?deviceId=${encodeURIComponent(deviceId)}`, {});
  return r.data ?? [];
}

export async function fetchStoriesFor(deviceIds: string[]): Promise<MobileStoryView[]> {
  if (deviceIds.length === 0) return [];
  const r = await getJson<{ data?: MobileStoryView[] }>(`/api/v1/social/stories?ids=${encodeURIComponent(deviceIds.join(","))}`, {});
  return r.data ?? [];
}

export interface StoryViewer {
  id: string;
  name: string | null;
  avatar: string | null;
  viewedAt: string;
}

/** Bir story'i gördüğümü kaydet (Instagram "seen by"). viewerId = kendi deviceId. */
export async function markStoryViewed(storyId: string): Promise<void> {
  if (!storyId) return;
  try {
    const viewerId = await getOrCreateDeviceId();
    await send("POST", "/api/v1/social/stories/views", { storyId, viewerId }, {});
  } catch {
    /* sessiz */
  }
}

/** Bir story'i kimler gördü + sayı (yalnız story sahibine gösterilir). */
export async function fetchStoryViewers(storyId: string): Promise<{ count: number; viewers: StoryViewer[] }> {
  if (!storyId) return { count: 0, viewers: [] };
  const r = await getJson<{ count?: number; viewers?: StoryViewer[] }>(
    `/api/v1/social/stories/views?storyId=${encodeURIComponent(storyId)}`,
    {},
  );
  return { count: r.count ?? 0, viewers: r.viewers ?? [] };
}

export async function deleteStoryRemote(id: string): Promise<boolean> {
  const deviceId = await getOrCreateDeviceId();
  const r = await send<{ ok?: boolean }>("DELETE", "/api/v1/social/stories", { id, deviceId }, {});
  return !!r.ok;
}

export async function updateStoryCaption(id: string, caption: string): Promise<boolean> {
  const deviceId = await getOrCreateDeviceId();
  const r = await send<{ ok?: boolean }>("PATCH", "/api/v1/social/stories", { id, deviceId, caption }, {});
  return !!r.ok;
}
