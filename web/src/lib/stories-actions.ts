"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { moderateMessage } from "./moderation";
import { getEventBySlug } from "./events";
import {
  addStory,
  getActiveUsers,
  getStoryViewers,
  listStoriesForUser,
  markViewed,
  removeStory,
  type ActiveUserStrip,
  type StoryItem,
  type StoryViewer,
} from "./stories-store";

const MAX_CAPTION_LEN = 200;
const LOCATION_COOKIE = "meydanfest_city";

/**
 * Client'a SET dönülmez (serileştirilemez). Strip listesi `hasUnviewed`
 * flag'ini taşır; viewer ise sadece hangi story'leri okuduğunu
 * `viewedByMe` boolean'ı üzerinden bilir.
 */
export interface PublicStory {
  id: string;
  userEmail: string;
  userName: string;
  userAvatarUrl?: string;
  userColor: string;
  imageUrl: string;
  caption?: string;
  eventSlug?: string;
  eventTitle?: string;
  city?: string;
  createdAt: string;
  viewedByMe: boolean;
  isMine: boolean;
  /** Sadece isMine için doldurulur — başkasının view count'unu görmek istemiyoruz */
  viewCount?: number;
}

function toPublic(s: StoryItem, viewerEmail: string | null): PublicStory {
  const isMine = !!viewerEmail && s.userEmail === viewerEmail;
  return {
    id: s.id,
    userEmail: s.userEmail,
    userName: s.userName,
    userAvatarUrl: s.userAvatarUrl,
    userColor: s.userColor,
    imageUrl: s.imageUrl,
    caption: s.caption,
    eventSlug: s.eventSlug,
    eventTitle: s.eventTitle,
    city: s.city,
    createdAt: s.createdAt,
    viewedByMe: !!viewerEmail && s.viewedBy.has(viewerEmail),
    isMine,
    viewCount: isMine ? s.viewedBy.size : undefined,
  };
}

async function getViewerEmail(): Promise<string | null> {
  const session = await auth().catch(() => null);
  return session?.user?.email ?? null;
}

async function getCityFromCookie(): Promise<string | undefined> {
  try {
    const store = await cookies();
    const raw = store.get(LOCATION_COOKIE)?.value;
    return raw ? decodeURIComponent(raw) : undefined;
  } catch {
    return undefined;
  }
}

export async function addStoryAction(input: {
  imageUrl: string;
  caption?: string;
  eventSlug?: string;
}): Promise<{ ok: boolean; story?: PublicStory; error?: string }> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  if (!email) {
    return { ok: false, error: "Story paylaşmak için giriş yapmalısın" };
  }

  // http(s)://... veya /api/r2-image/... (proxy) kabul et
  if (
    !input.imageUrl ||
    (!/^https?:\/\//i.test(input.imageUrl) &&
      !input.imageUrl.startsWith("/api/"))
  ) {
    return { ok: false, error: "Geçersiz görsel URL'si" };
  }

  const trimmed = (input.caption ?? "").trim();
  if (trimmed.length > MAX_CAPTION_LEN) {
    return {
      ok: false,
      error: `Açıklama en fazla ${MAX_CAPTION_LEN} karakter olabilir`,
    };
  }
  if (trimmed.length > 0) {
    const mod = moderateMessage(email, trimmed);
    if (!mod.ok) {
      return { ok: false, error: mod.message ?? "Açıklama reddedildi" };
    }
  }

  let eventTitle: string | undefined;
  if (input.eventSlug) {
    const ev = await getEventBySlug(input.eventSlug).catch(() => null);
    if (!ev) {
      return { ok: false, error: "Etkinlik bulunamadı" };
    }
    eventTitle = ev.title;
  }

  const city = await getCityFromCookie();

  const story = await addStory({
    userEmail: email,
    userName: session?.user?.name?.trim() || email.split("@")[0],
    userAvatarUrl: session?.user?.image ?? undefined,
    userColor: "#7c3aed",
    imageUrl: input.imageUrl,
    caption: trimmed || undefined,
    eventSlug: input.eventSlug,
    eventTitle,
    city,
  });

  revalidatePath("/");
  if (input.eventSlug) revalidatePath(`/etkinlik/${input.eventSlug}`);

  return { ok: true, story: toPublic(story, email) };
}

export async function removeStoryAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = await getViewerEmail();
  if (!email) {
    return { ok: false, error: "Silmek için giriş yapmalısın" };
  }
  const ok = await removeStory(id, email);
  if (!ok) {
    return { ok: false, error: "Story bulunamadı veya silme yetkin yok" };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function markViewedAction(
  id: string,
): Promise<{ ok: boolean }> {
  const email = await getViewerEmail();
  if (!email) return { ok: false };
  await markViewed(id, email);
  return { ok: true };
}

export async function fetchStoriesAction(opts?: {
  eventSlug?: string;
}): Promise<ActiveUserStrip[]> {
  const email = await getViewerEmail();
  return getActiveUsers(email, { eventSlug: opts?.eventSlug });
}

export async function fetchUserStoriesAction(
  userEmail: string,
): Promise<PublicStory[]> {
  const viewer = await getViewerEmail();
  const list = await listStoriesForUser(userEmail);
  return list.map((s) => toPublic(s, viewer));
}

/**
 * Bir story'i kimlerin gördüğünü döndürür — yalnızca story sahibi
 * çağrı yapabilir (gizlilik).
 */
export async function fetchStoryViewersAction(
  storyId: string,
): Promise<{ ok: boolean; viewers?: StoryViewer[]; count?: number; error?: string }> {
  const viewer = await getViewerEmail();
  if (!viewer) return { ok: false, error: "Giriş gerekli" };

  // Bu story benimki mi kontrol et
  const mine = await listStoriesForUser(viewer);
  const ownsIt = mine.some((s) => s.id === storyId);
  if (!ownsIt) {
    return { ok: false, error: "Bu story senin değil" };
  }

  const viewers = await getStoryViewers(storyId);
  return { ok: true, viewers, count: viewers.length };
}
