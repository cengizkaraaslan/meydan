"use server";

import { revalidatePath } from "next/cache";
import {
  getMyReview,
  listReviews,
  removeReview,
  summarize,
  upsertReview,
  type ReviewSummary,
  type SerializedReview,
} from "./reviews-store";
import { moderateMessage } from "./moderation";
import { auth } from "@/auth";

export async function listReviewsAction(
  slug: string,
): Promise<{ items: SerializedReview[]; summary: ReviewSummary; mine: SerializedReview | null }> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? "anon";
  const [items, summary] = await Promise.all([listReviews(slug, email), summarize(slug)]);
  const mine = items.find((r) => r.isMine) ?? null;
  return { items, summary, mine };
}

export async function submitReviewAction(
  slug: string,
  rating: number,
  comment: string,
): Promise<{ ok: boolean; review?: SerializedReview; summary?: ReviewSummary; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return { ok: false, error: "Yıldız vermek için giriş yapmalısın" };
  }
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return { ok: false, error: "Geçersiz yıldız sayısı" };
  }
  const trimmed = comment.trim();
  if (trimmed.length > 0) {
    const mod = moderateMessage(session.user.email ?? "anon", trimmed);
    if (!mod.ok) {
      return { ok: false, error: mod.message ?? "Yorum reddedildi" };
    }
  }
  const stored = await upsertReview({
    slug,
    authorEmail: session.user.email ?? "anon",
    authorName: session.user.name ?? "Sen",
    authorColor: "#6366f1",
    rating,
    comment: trimmed,
  });
  revalidatePath(`/etkinlik/${slug}`);
  return {
    ok: true,
    review: {
      id: stored.id,
      authorEmail: stored.authorEmail,
      authorName: stored.authorName,
      authorColor: stored.authorColor,
      rating: stored.rating,
      comment: stored.comment,
      createdAt: stored.createdAt,
      isMine: true,
    },
    summary: await summarize(slug),
  };
}

export async function removeReviewAction(
  slug: string,
): Promise<{ ok: boolean; summary?: ReviewSummary; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return { ok: false, error: "Giriş gerekli" };
  }
  const removed = await removeReview(slug, session.user.email ?? "anon");
  if (!removed) return { ok: false, error: "Senin değerlendirmen yok" };
  revalidatePath(`/etkinlik/${slug}`);
  return { ok: true, summary: await summarize(slug) };
}
