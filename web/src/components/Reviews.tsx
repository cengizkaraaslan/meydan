"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Star, LogIn, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  removeReviewAction,
  submitReviewAction,
} from "@/lib/reviews-actions";
import type { ReviewSummary, SerializedReview } from "@/lib/reviews-store";

interface ReviewsProps {
  slug: string;
  isLoggedIn: boolean;
  initialItems: SerializedReview[];
  initialSummary: ReviewSummary;
  initialMine: SerializedReview | null;
}

/** Dağılım dizisinden (1★..5★ sayıları) özeti yeniden hesaplar — optimistic güncelleme için. */
function recomputeSummary(
  distribution: [number, number, number, number, number],
): ReviewSummary {
  const count = distribution.reduce((a, b) => a + b, 0);
  const total = distribution.reduce((a, b, i) => a + b * (i + 1), 0);
  return { count, average: count ? total / count : 0, distribution };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes}dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g önce`;
  return `${Math.floor(days / 30)}ay önce`;
}

function StarRow({
  value,
  max = 5,
  size = "size-4",
  interactive = false,
  onChange,
}: {
  value: number;
  max?: number;
  size?: string;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const displayValue = hover || value;
  return (
    <div className="inline-flex items-center" role={interactive ? "radiogroup" : undefined}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < displayValue;
        const half = !filled && i < displayValue + 0.5;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            onMouseEnter={() => interactive && setHover(i + 1)}
            onMouseLeave={() => interactive && setHover(0)}
            className={`${interactive ? "cursor-pointer hover:scale-110 transition-transform p-0.5" : "p-0"}`}
            aria-label={`${i + 1} yıldız`}
          >
            <Star
              className={`${size} ${
                filled || half
                  ? "fill-[var(--accent)] text-[var(--accent)]"
                  : "text-[var(--border)]"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function Reviews({
  slug,
  isLoggedIn,
  initialItems,
  initialSummary,
  initialMine,
}: ReviewsProps) {
  const [items, setItems] = useState<SerializedReview[]>(initialItems);
  const [summary, setSummary] = useState<ReviewSummary>(initialSummary);
  const [mine, setMine] = useState<SerializedReview | null>(initialMine);
  const [draftRating, setDraftRating] = useState(mine?.rating ?? 0);
  const [draftComment, setDraftComment] = useState(mine?.comment ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!isLoggedIn || draftRating < 1) return;

    // Optimistic: yıldız/yorum anında listede ve özet grafiğinde görünsün; sunucu
    // dönünce gerçek kayıtla (id, ad, renk) uzlaş, hata olursa eski hâli geri yükle.
    const snapshot = { items, summary, mine };
    const optimistic: SerializedReview = {
      id: mine?.id ?? `tmp-${Date.now()}`,
      authorEmail: mine?.authorEmail ?? "",
      authorName: mine?.authorName ?? "Sen",
      authorColor: mine?.authorColor ?? "#6366f1",
      rating: draftRating,
      comment: draftComment.trim(),
      createdAt: new Date().toISOString(),
      isMine: true,
    };
    const dist = [...summary.distribution] as ReviewSummary["distribution"];
    if (mine) dist[mine.rating - 1] = Math.max(0, dist[mine.rating - 1] - 1);
    dist[draftRating - 1] += 1;
    const wasEditing = !!mine;
    setMine(optimistic);
    setSummary(recomputeSummary(dist));
    setItems((prev) => [optimistic, ...prev.filter((r) => !r.isMine)]);
    toast.success(wasEditing ? "Değerlendirmen güncellendi" : "Değerlendirmen yayınlandı");

    startTransition(async () => {
      const res = await submitReviewAction(slug, draftRating, draftComment);
      if (!res.ok || !res.review || !res.summary) {
        setItems(snapshot.items);
        setSummary(snapshot.summary);
        setMine(snapshot.mine);
        toast.error(res.error ?? "Değerlendirme gönderilemedi");
        return;
      }
      setMine(res.review);
      setSummary(res.summary);
      setItems((prev) => [res.review!, ...prev.filter((r) => !r.isMine)]);
    });
  }

  function remove() {
    if (!mine) return;

    // Optimistic: değerlendirmeyi anında kaldır + özeti yerelde güncelle; hata olursa geri al.
    const snapshot = { items, summary, mine };
    const dist = [...summary.distribution] as ReviewSummary["distribution"];
    dist[mine.rating - 1] = Math.max(0, dist[mine.rating - 1] - 1);
    setMine(null);
    setSummary(recomputeSummary(dist));
    setItems((prev) => prev.filter((r) => !r.isMine));
    setDraftRating(0);
    setDraftComment("");
    toast.success("Değerlendirmen kaldırıldı");

    startTransition(async () => {
      const res = await removeReviewAction(slug);
      if (!res.ok || !res.summary) {
        setItems(snapshot.items);
        setSummary(snapshot.summary);
        setMine(snapshot.mine);
        setDraftRating(snapshot.mine?.rating ?? 0);
        setDraftComment(snapshot.mine?.comment ?? "");
        toast.error(res.error ?? "Silinemedi");
        return;
      }
      setSummary(res.summary);
    });
  }

  const maxDist = Math.max(...summary.distribution, 1);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star className="size-4 fill-[var(--accent)] text-[var(--accent)]" />
        <h3 className="font-semibold">Etkinlik Değerlendirmeleri</h3>
        <span className="text-xs text-[var(--muted)]">({summary.count})</span>
      </div>

      {summary.count > 0 ? (
        <div className="grid sm:grid-cols-[200px_1fr] gap-5 mb-6 pb-5 border-b border-[var(--border)]">
          <div className="text-center">
            <div className="text-4xl font-bold">{summary.average.toFixed(1)}</div>
            <StarRow value={Math.round(summary.average)} />
            <div className="text-xs text-[var(--muted)] mt-1">
              {summary.count} değerlendirme
            </div>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.distribution[stars - 1];
              const pct = (count / maxDist) * 100;
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-end">{stars}</span>
                  <Star className="size-3 fill-[var(--accent)] text-[var(--accent)] shrink-0" />
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--muted-bg)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-[var(--muted)]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isLoggedIn ? (
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--muted-bg)]/30 p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="text-sm font-medium">
              {mine ? "Değerlendirmen" : "Etkinliği değerlendir"}
            </div>
            <StarRow
              value={draftRating}
              size="size-6"
              interactive
              onChange={setDraftRating}
            />
          </div>
          <textarea
            value={draftComment}
            onChange={(e) => setDraftComment(e.target.value)}
            placeholder="Deneyimini kısaca paylaş (opsiyonel)"
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {mine && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Sil
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={draftRating < 1 || pending}
              className="rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-40"
            >
              {mine ? "Güncelle" : "Gönder"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)] px-4 py-3">
          <div className="flex-1 text-sm text-[var(--muted)]">
            Değerlendirme yapmak için <span className="font-medium text-[var(--foreground)]">giriş yapmalısın</span>.
          </div>
          <Link
            href="/giris"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 text-sm font-semibold"
          >
            <LogIn className="size-3.5" />
            Giriş yap
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-sm text-[var(--muted)] text-center py-4">
          Henüz değerlendirme yok. İlk yıldızı sen ver!
        </div>
      ) : (
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {items.map((r) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-3"
              >
                <span
                  className="grid size-9 place-items-center rounded-full text-white text-sm font-semibold shrink-0"
                  style={{ background: r.authorColor }}
                >
                  {r.authorName.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.authorName}</span>
                    {r.isMine && (
                      <span className="text-[10px] uppercase tracking-wider rounded-full bg-[var(--primary)]/15 text-[var(--primary)] px-1.5 py-0.5 font-semibold">
                        Sen
                      </span>
                    )}
                    <StarRow value={r.rating} size="size-3.5" />
                    <span className="text-xs text-[var(--muted)]">• {relativeTime(r.createdAt)}</span>
                  </div>
                  {r.comment && (
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {r.comment}
                    </p>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
