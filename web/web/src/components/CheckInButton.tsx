"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  checkInAction,
  removeCheckInAction,
} from "@/lib/checkin-actions";
import { useClientSession } from "@/lib/use-session";
import { LoginRequiredModal } from "./LoginRequiredModal";
import { Avatar } from "./ui/Avatar";
import { playSuccessDing, playClick } from "@/lib/sounds";
import type { CheckIn } from "@/lib/checkin-store";

const MOODS = ["🔥", "🎉", "😎", "❤️", "✨", "🎵"];

interface CheckInButtonProps {
  slug: string;
  initialCount: number;
  initialMine: boolean;
  initialList: CheckIn[];
}

export function CheckInButton({
  slug,
  initialCount,
  initialMine,
  initialList,
}: CheckInButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [mine, setMine] = useState(initialMine);
  const [list, setList] = useState(initialList);
  const [showMood, setShowMood] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pending, startTransition] = useTransition();
  const { isLoggedIn, loading, email } = useClientSession();

  function startCheckIn() {
    if (!loading && !isLoggedIn) {
      setShowLogin(true);
      return;
    }
    setShowMood(true);
  }

  function submit(mood?: string) {
    setShowMood(false);
    startTransition(async () => {
      const res = await checkInAction(slug, mood);
      if (!res.ok) {
        toast.error(res.error ?? "Check-in başarısız");
        if (res.count !== undefined) setCount(res.count);
        return;
      }
      if (res.checkIn) {
        setMine(true);
        setCount(res.count ?? count + 1);
        setList((prev) => [res.checkIn!, ...prev]);
        playSuccessDing();
        toast.success("Buradasın! 🎉 Bunu görenler senin yanına gelebilir.");
      }
    });
  }

  function undo() {
    startTransition(async () => {
      const res = await removeCheckInAction(slug);
      if (!res.ok) {
        toast.error(res.error ?? "Geri alınamadı");
        return;
      }
      setMine(false);
      setCount(res.count ?? Math.max(0, count - 1));
      // Optimistic remove: kendi check-in'imi listeden çıkar (oturum e-postasıyla eşleştir)
      setList((prev) => (email ? prev.filter((c) => c.userEmail !== email) : prev));
      toast.success("Check-in geri alındı");
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2">
            <MapPin className="size-4 text-[var(--primary)]" />
            Buradayım
          </h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {count > 0
              ? `${count.toLocaleString("tr-TR")} kişi şu an etkinlikte`
              : "Henüz kimse check-in yapmadı — ilk sen ol"}
          </p>
        </div>

        {mine ? (
          <button
            type="button"
            onClick={undo}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)]/10 text-[var(--success)] ring-1 ring-[var(--success)]/30 px-3 py-1.5 text-sm font-semibold hover:bg-[var(--success)]/15 transition-colors disabled:opacity-50"
          >
            <Check className="size-4" />
            Buradasın
          </button>
        ) : (
          <motion.button
            type="button"
            onClick={startCheckIn}
            disabled={pending}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -1 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-4 py-2 text-sm font-semibold shadow-md hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            <MapPin className="size-4" />
            Buradayım
          </motion.button>
        )}
      </div>

      {/* Mood seçici */}
      <AnimatePresence>
        {showMood && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--muted-bg)] p-3">
              <span className="text-xs text-[var(--muted)]">Bir tepki seç:</span>
              <div className="flex items-center gap-1">
                {MOODS.map((m) => (
                  <motion.button
                    key={m}
                    type="button"
                    onClick={() => submit(m)}
                    whileTap={{ scale: 0.85 }}
                    whileHover={{ scale: 1.15 }}
                    className="size-9 grid place-items-center rounded-full hover:bg-[var(--background)] text-lg transition-colors"
                  >
                    {m}
                  </motion.button>
                ))}
                <button
                  type="button"
                  onClick={() => submit()}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2"
                >
                  geç →
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowMood(false)}
                aria-label="Kapat"
                className="text-[var(--muted)] hover:text-[var(--danger)]"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Son check-in'ler */}
      {list.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-2">
          {list.slice(0, 8).map((ci) => (
            <li
              key={ci.id}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--muted-bg)] py-1 ps-1 pe-3"
              title={`${ci.userName} • ${relativeTime(ci.createdAt)}`}
            >
              <Avatar
                src={ci.userAvatarUrl}
                name={ci.userName}
                color={ci.userColor}
                size="size-7"
              />
              <span className="text-xs font-medium">{ci.userName}</span>
              {ci.mood && <span className="text-sm">{ci.mood}</span>}
              <span className="text-[10px] text-[var(--muted)]">
                {relativeTime(ci.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <LoginRequiredModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        title="Check-in için giriş gerekli"
        description="Etkinlikte olduğunu paylaşmak ve diğer katılımcılarla buluşmak için MeydanFest hesabına ihtiyacın var."
      />
    </section>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes}dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa`;
  return `${Math.floor(hours / 24)}g`;
}
