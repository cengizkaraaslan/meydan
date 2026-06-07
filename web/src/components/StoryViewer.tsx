"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, MapPin, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchStoryViewersAction,
  fetchUserStoriesAction,
  markViewedAction,
  removeStoryAction,
  type PublicStory,
} from "@/lib/stories-actions";
import type { StoryViewer as StoryViewerType } from "@/lib/stories-store";
import { Avatar } from "./ui/Avatar";
import { playStoryOpen, playStoryTick } from "@/lib/sounds";

/** "ahmet@gmail.com" -> "ahmet" — profil URL'i için */
function profileSlugFromEmail(email: string): string {
  return email
    .split("@")[0]
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9_-]/g, "");
}

interface StoryViewerProps {
  open: boolean;
  userEmails: string[]; // ringe tıklanan kullanıcının sırası ile birlikte tüm aktif kullanıcılar
  initialUserIndex: number;
  currentUserEmail: string | null;
  onClose: () => void;
  /** Bir story silinince strip'e haber ver */
  onStoryRemoved?: (id: string) => void;
}

const STORY_DURATION_MS = 5000;

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return "1 gün önce";
}

function StoryImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[var(--primary)]/40 via-[var(--accent)]/30 to-fuchsia-500/40">
        <div className="text-white/80 text-sm">Görsel yüklenemedi</div>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

export function StoryViewer({
  open,
  userEmails,
  initialUserIndex,
  currentUserEmail,
  onClose,
  onStoryRemoved,
}: StoryViewerProps) {
  const [userIdx, setUserIdx] = useState(initialUserIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [, startTransition] = useTransition();
  const lastMarkedRef = useRef<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setUserIdx(initialUserIndex);
      setStoryIdx(0);
    }
  }, [open, initialUserIndex]);

  const currentUser = userEmails[userIdx];

  // Load stories when user changes
  useEffect(() => {
    if (!open || !currentUser) return;
    let alive = true;
    setLoading(true);
    fetchUserStoriesAction(currentUser).then((list) => {
      if (!alive) return;
      setStories(list);
      setStoryIdx(0);
      setProgress(0);
      setLoading(false);
      // İlk açılışta whoosh sesi
      playStoryOpen();
    });
    return () => {
      alive = false;
    };
  }, [open, currentUser]);

  const current = stories[storyIdx];

  const goNextUser = useCallback(() => {
    if (userIdx + 1 < userEmails.length) {
      setUserIdx(userIdx + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [userIdx, userEmails.length, onClose]);

  const goPrevUser = useCallback(() => {
    if (userIdx > 0) {
      setUserIdx(userIdx - 1);
      setStoryIdx(0);
      setProgress(0);
    }
  }, [userIdx]);

  const goNext = useCallback(() => {
    if (storyIdx + 1 < stories.length) {
      setStoryIdx(storyIdx + 1);
      setProgress(0);
      playStoryTick();
    } else {
      goNextUser();
    }
  }, [storyIdx, stories.length, goNextUser]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
      setProgress(0);
      playStoryTick();
    } else {
      goPrevUser();
    }
  }, [storyIdx, goPrevUser]);

  // Auto-advance progress (viewers modal acikken duraklat)
  useEffect(() => {
    if (!open || loading || !current || paused || showViewers) return;
    const start = Date.now() - progress * STORY_DURATION_MS;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(next);
      if (next >= 1) {
        clearInterval(id);
        goNext();
      }
    }, 50);
    return () => clearInterval(id);
    // progress kasten dep'lere eklenmedi — start hesaplandı
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, current?.id, paused, showViewers, goNext]);

  // Mark viewed (server)
  useEffect(() => {
    if (!open || !current) return;
    if (current.viewedByMe) return;
    if (lastMarkedRef.current === current.id) return;
    lastMarkedRef.current = current.id;
    startTransition(() => {
      markViewedAction(current.id).catch(() => {});
    });
  }, [open, current?.id, current?.viewedByMe, startTransition, current]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  function handleDelete() {
    if (!current?.isMine) return;
    if (!window.confirm("Bu story'yi silmek istediğine emin misin?")) return;
    const removedId = current.id;
    startTransition(async () => {
      const res = await removeStoryAction(removedId);
      if (!res.ok) {
        toast.error(res.error ?? "Silinemedi");
        return;
      }
      toast.success("Story silindi");
      onStoryRemoved?.(removedId);
      const next = stories.filter((s) => s.id !== removedId);
      if (next.length === 0) {
        goNextUser();
      } else {
        setStories(next);
        setStoryIdx(Math.min(storyIdx, next.length - 1));
        setProgress(0);
      }
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] grid place-items-center bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Hikaye görüntüleyici"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute top-4 right-4 z-20 inline-flex items-center justify-center size-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="size-5" />
          </button>

          <div className="relative w-full max-w-md h-full sm:h-[88vh] sm:max-h-[860px] sm:rounded-3xl overflow-hidden bg-black flex flex-col">
            {/* Progress bars */}
            <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-1 px-3 pt-3">
              {stories.length === 0
                ? [0].map((i) => (
                    <div
                      key={i}
                      className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden"
                    />
                  ))
                : stories.map((_, i) => (
                    <div
                      key={i}
                      className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden"
                    >
                      <div
                        className="h-full bg-white transition-[width] duration-100"
                        style={{
                          width:
                            i < storyIdx
                              ? "100%"
                              : i === storyIdx
                                ? `${progress * 100}%`
                                : "0%",
                        }}
                      />
                    </div>
                  ))}
            </div>

            {/* User chip — avatar + isim profile linkler.
                pe-14: sağ üstteki Kapat(X) butonuyla çakışmasın diye sil butonuna yer aç. */}
            <div className="absolute top-7 inset-x-0 z-10 flex items-center gap-2 ps-4 pe-16 pt-2 text-white">
              {current ? (
                <Link
                  href={`/profil/${encodeURIComponent(profileSlugFromEmail(current.userEmail))}`}
                  onClick={onClose}
                  className="flex items-center gap-2 flex-1 min-w-0 rounded-full -mx-1 px-1 py-0.5 hover:bg-white/10 transition-colors"
                  aria-label={`${current.userName} profilini görüntüle`}
                >
                  <Avatar
                    src={current.userAvatarUrl ?? null}
                    name={current.userName}
                    color={current.userColor}
                    size="size-8"
                    ring
                  />
                  <div className="flex-1 min-w-0 text-start">
                    <div className="text-sm font-semibold truncate">
                      {current.userName}
                    </div>
                    <div className="text-[11px] text-white/70">
                      {relativeTime(current.createdAt)}
                    </div>
                  </div>
                </Link>
              ) : (
                <>
                  <Avatar src={null} name="?" color="#7c3aed" size="size-8" ring />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">Yükleniyor...</div>
                    <div className="text-[11px] text-white/70" />
                  </div>
                </>
              )}
              {current?.isMine && (
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Story sil"
                  className="inline-flex items-center justify-center size-9 rounded-full bg-white/10 hover:bg-[var(--danger)] transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>

            {/* Image / drag area */}
            <motion.div
              className="relative flex-1 w-full"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) goNext();
                else if (info.offset.x > 60) goPrev();
              }}
              onPointerDown={() => setPaused(true)}
              onPointerUp={() => setPaused(false)}
              onPointerLeave={() => setPaused(false)}
              onPointerCancel={() => setPaused(false)}
            >
              {current && (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0"
                >
                  <StoryImage src={current.imageUrl} alt={current.caption ?? current.userName} />
                </motion.div>
              )}
              {!current && !loading && (
                <div className="absolute inset-0 grid place-items-center text-white/80 text-sm">
                  Henüz aktif hikaye yok
                </div>
              )}

              {/* Tap zones */}
              <button
                type="button"
                aria-label="Önceki"
                onClick={goPrev}
                className="absolute inset-y-0 left-0 w-1/3 z-[5]"
              />
              <button
                type="button"
                aria-label="Sonraki"
                onClick={goNext}
                className="absolute inset-y-0 right-0 w-1/3 z-[5]"
              />
            </motion.div>

            {/* Bottom overlay: caption + event chip + viewer count (kendi storyimde) */}
            {current && (current.caption || current.eventSlug || current.isMine) && (
              <div className="absolute bottom-0 inset-x-0 z-10 p-4 pb-6 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white">
                {current.caption && (
                  <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap break-words">
                    {current.caption}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {current.eventSlug && current.eventTitle && (
                    <Link
                      href={`/etkinlik/${current.eventSlug}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-medium hover:bg-white/25 transition-colors"
                    >
                      <MapPin className="size-3.5" />
                      {current.eventTitle}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                  {current.isMine && (
                    <button
                      type="button"
                      onClick={() => setShowViewers(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-semibold hover:bg-white/25 transition-colors"
                    >
                      <Eye className="size-3.5" />
                      {current.viewCount ?? 0}{" "}
                      {(current.viewCount ?? 0) === 1 ? "kişi gördü" : "kişi gördü"}
                      {(current.viewCount ?? 0) > 0 && <ArrowRight className="size-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Viewer listesi modal — sadece kendi storyim için açılır */}
          <ViewersModal
            open={showViewers}
            onClose={() => setShowViewers(false)}
            storyId={current?.id ?? null}
          />

          {/* Outside hint — guest viewers */}
          {!currentUserEmail && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[11px] text-white/60">
              Sen de paylaşmak için <Link href="/giris" className="underline">giriş yap</Link>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Hikayemi görenler listesi — Instagram tarzı */
function ViewersModal({
  open,
  onClose,
  storyId,
}: {
  open: boolean;
  onClose: () => void;
  storyId: string | null;
}) {
  const [viewers, setViewers] = useState<StoryViewerType[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !storyId) return;
    setLoading(true);
    fetchStoryViewersAction(storyId)
      .then((res) => {
        if (res.ok) {
          setViewers(res.viewers ?? []);
          setCount(res.count ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, [open, storyId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] grid place-items-end sm:place-items-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
        >
          <motion.div
            role="dialog"
            initial={{ y: 60, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden"
          >
            <header className="flex items-center justify-between gap-2 p-4 border-b border-[var(--border)]">
              <div className="inline-flex items-center gap-2">
                <Eye className="size-4 text-[var(--primary)]" />
                <div>
                  <div className="font-semibold text-sm">Hikayeyi görenler</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {loading ? "Yükleniyor..." : `${count} kişi`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="grid place-items-center size-9 rounded-full text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)] transition-colors"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-sm text-[var(--muted)]">
                  Yükleniyor...
                </div>
              ) : viewers.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-3xl mb-2">👻</div>
                  <div className="text-sm text-[var(--muted)]">
                    Henüz kimse görmemiş.
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-1">
                    24 saat içinde herkesin görmesi için biraz daha bekle.
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {viewers.map((v) => (
                    <li key={v.email}>
                      <Link
                        href={`/profil/${encodeURIComponent(profileSlugFromEmail(v.email))}`}
                        onClick={onClose}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-bg)] transition-colors"
                      >
                        <Avatar
                          src={v.avatarUrl}
                          name={v.name}
                          color={v.color}
                          size="size-10"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {v.name}
                          </div>
                          <div className="text-[11px] text-[var(--muted)] truncate">
                            @{v.email.split("@")[0]}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
