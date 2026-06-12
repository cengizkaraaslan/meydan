import type { EventComment } from "./eventComments";
import type { PostComment } from "./social";

/**
 * İki yorum yüzeyini (etkinlik + feed) tek bir UI bileşeninin çizebilmesi için ortak model.
 * Adaptörler EventComment / PostComment → ThreadComment dönüşümünü yapar.
 */
export interface ThreadComment {
  id: string;
  authorName: string;
  avatar?: string | null;
  text: string;
  createdAt: string;
  ownerDeviceId: string; // sil/düzenle yetkisi
  replyTo: { id: string; authorName: string; snippet: string } | null;
  reactions: Record<string, number>; // emoji -> sayı
  reactionTotal: number;
  myReaction: string | null;
  replyCount: number;
}

export function eventToThread(c: EventComment): ThreadComment {
  return {
    id: c.id,
    authorName: c.authorName?.trim() || "Meydanlı",
    avatar: c.avatar,
    text: c.text,
    createdAt: c.createdAt,
    ownerDeviceId: c.deviceId,
    replyTo: c.replyTo ? { id: c.replyTo.id, authorName: c.replyTo.authorName?.trim() || "Meydanlı", snippet: c.replyTo.snippet } : null,
    reactions: c.reactions ?? {},
    reactionTotal: c.reactionTotal ?? 0,
    myReaction: c.myReaction ?? null,
    replyCount: c.replyCount ?? 0,
  };
}

export function postToThread(c: PostComment): ThreadComment {
  return {
    id: c.id,
    authorName: c.authorName?.trim() || "Meydanlı",
    avatar: null,
    text: c.text,
    createdAt: c.createdAt,
    ownerDeviceId: c.deviceId,
    replyTo: c.replyTo ? { id: c.replyTo.id, authorName: c.replyTo.authorName?.trim() || "Meydanlı", snippet: c.replyTo.snippet } : null,
    reactions: c.reactions ?? {},
    reactionTotal: c.reactionTotal ?? 0,
    myReaction: c.myReaction ?? null,
    replyCount: c.replyCount ?? 0,
  };
}

/** Kısa göreli zaman ("şimdi" / "3 dk" / "2 sa" / "5 g" / "3 hf"). */
export function commentRelTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const m = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} g`;
  return `${Math.floor(d / 7)} hf`;
}
