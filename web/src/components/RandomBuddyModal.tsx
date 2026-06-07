"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, RefreshCw, Sparkles, X, MapPin, Loader2, Frown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { useClientSession } from "@/lib/use-session";
import type { RandomBuddyProfile } from "@/lib/random-buddy";

interface RandomBuddyModalProps {
  open: boolean;
  onClose: () => void;
  /** Cookie'den / hero'dan gelen aktif şehir. */
  city?: string;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; buddy: RandomBuddyProfile; direction: 1 | -1 }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function RandomBuddyModal({ open, onClose, city }: RandomBuddyModalProps) {
  const router = useRouter();
  const session = useClientSession();
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [excluded, setExcluded] = useState<string[]>([]);
  const [loginGate, setLoginGate] = useState(false);

  const fetchBuddy = useCallback(
    async (currentExcluded: string[]) => {
      setState({ kind: "loading" });
      try {
        const params = new URLSearchParams();
        if (city) params.set("city", city);
        if (currentExcluded.length > 0) params.set("exclude", currentExcluded.join(","));
        const res = await fetch(`/api/random-buddy?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("İstek başarısız");
        const data = (await res.json()) as { buddy: RandomBuddyProfile | null };
        if (!data.buddy) {
          setState({ kind: "empty" });
          return;
        }
        setState({ kind: "ready", buddy: data.buddy, direction: 1 });
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Bir şeyler ters gitti",
        });
      }
    },
    [city],
  );

  // Modal açılınca ilk buddy'yi getir; kapanınca sıfırla.
  useEffect(() => {
    if (!open) return;
    setExcluded([]);
    fetchBuddy([]);
  }, [open, fetchBuddy]);

  // ESC ile kapat + body scroll lock
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function handleNext() {
    if (state.kind !== "ready") {
      fetchBuddy(excluded);
      return;
    }
    const nextExcluded = [...excluded, state.buddy.username];
    setExcluded(nextExcluded);
    void fetchBuddy(nextExcluded);
  }

  function handleMessage() {
    if (state.kind !== "ready") return;
    if (!session.isLoggedIn && !session.loading) {
      setLoginGate(true);
      return;
    }
    const username = state.buddy.username;
    onClose();
    router.push(`/mesaj/${username}`);
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[85] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.92, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Sürpriz buddy önerisi"
              className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
            >
              {/* Dekoratif gradient */}
              <motion.div
                className="absolute -top-16 -right-16 size-56 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] opacity-25 blur-3xl pointer-events-none"
                animate={{ scale: [1, 1.15, 1], rotate: [0, 90, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />

              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="absolute top-3 end-3 z-10 grid place-items-center size-8 rounded-full text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)] transition-colors"
              >
                <X className="size-4" />
              </button>

              <div className="relative p-5 sm:p-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] px-3 py-1 text-[11px] font-semibold">
                    <Sparkles className="size-3.5" />
                    Sürpriz biriyle eşleştik
                  </div>
                  <h2 className="mt-3 text-lg sm:text-xl font-bold tracking-tight">
                    Belki <span className="gradient-text">birlikte</span> gidersiniz?
                  </h2>
                </div>

                <div className="relative min-h-[280px] grid place-items-center">
                  <AnimatePresence mode="wait" initial={false}>
                    {state.kind === "loading" && (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="text-center text-[var(--muted)] py-10"
                      >
                        <Loader2 className="size-6 mx-auto animate-spin text-[var(--primary)]" />
                        <p className="mt-3 text-sm">Sana biri aranıyor…</p>
                      </motion.div>
                    )}

                    {state.kind === "empty" && (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-10 px-2"
                      >
                        <Frown className="size-10 mx-auto text-[var(--muted)]" />
                        <p className="mt-3 font-semibold">Pool şimdilik tükendi</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Bugünlük buddy önerilerimiz bitti — yarın yeniden dene.
                        </p>
                      </motion.div>
                    )}

                    {state.kind === "error" && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-10 px-2"
                      >
                        <p className="text-sm text-[var(--muted)]">{state.message}</p>
                        <button
                          type="button"
                          onClick={() => fetchBuddy(excluded)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--muted-bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--border)] transition-colors"
                        >
                          <RefreshCw className="size-3.5" /> Tekrar dene
                        </button>
                      </motion.div>
                    )}

                    {state.kind === "ready" && (
                      <BuddyCard key={state.buddy.username} buddy={state.buddy} />
                    )}
                  </AnimatePresence>
                </div>

                {/* Aksiyonlar */}
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={handleMessage}
                    disabled={state.kind !== "ready"}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-4 py-3 text-sm font-semibold shadow-lg glow-primary hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageSquare className="size-4" />
                    Mesaj at
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={state.kind === "loading"}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`size-4 ${state.kind === "loading" ? "animate-spin" : ""}`} />
                    Sıradaki
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors py-1"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LoginRequiredModal
        open={loginGate}
        onClose={() => setLoginGate(false)}
        title="Mesaj göndermek için giriş yap"
        description="MeydanFest hesabınla giriş yap, sürpriz buddy ile sohbete başla."
      />
    </>
  );
}

/** Tek buddy kartı — Tinder-vibe slide-in/out animasyonlu. */
function BuddyCard({ buddy }: { buddy: RandomBuddyProfile }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60, rotate: 8, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
      exit={{ opacity: 0, x: -80, rotate: -10, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="w-full text-center"
    >
      <div className="relative inline-block">
        {/* Renkli halo */}
        <div
          className="absolute inset-0 rounded-3xl blur-xl opacity-40"
          style={{ background: `radial-gradient(circle, ${buddy.color} 0%, transparent 70%)` }}
          aria-hidden="true"
        />
        <div
          className="relative rounded-3xl p-1"
          style={{
            background: `linear-gradient(135deg, ${buddy.color}, ${buddy.color}66)`,
          }}
        >
          <Avatar
            src={buddy.avatarUrl}
            name={buddy.name}
            color={buddy.color}
            size="size-28"
            className="!rounded-3xl"
          />
        </div>
        {buddy.mockOnline && (
          <span
            className="absolute bottom-1 end-1 grid place-items-center size-5 rounded-full bg-[var(--success)] ring-4 ring-[var(--card)]"
            aria-label="Şu anda online"
            title="Şu anda online"
          />
        )}
      </div>

      <div className="mt-3">
        <h3 className="text-lg font-bold tracking-tight">{buddy.name}</h3>
        {buddy.city && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <MapPin className="size-3" /> {buddy.city}
          </p>
        )}
        <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">{buddy.bio}</p>
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] px-3 py-1 text-xs font-semibold ring-1 ring-[var(--primary)]/20">
        <Sparkles className="size-3.5" />
        %{buddy.compatScore} uyum
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {buddy.sharedInterests.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-[var(--muted-bg)] text-[11px] px-2.5 py-0.5 font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
