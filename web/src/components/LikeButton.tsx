"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useClientSession } from "@/lib/use-session";
import { LoginRequiredModal } from "./LoginRequiredModal";
import { playClick } from "@/lib/sounds";

interface LikeButtonProps {
  eventId: string;
  initialCount: number;
  size?: "sm" | "lg";
  showCount?: boolean;
  className?: string;
}

const LS_KEY = "es.likes";

function readLikes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeLikes(set: Set<string>) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch {}
}

export function LikeButton({ eventId, initialCount, size = "sm", showCount = true, className }: LikeButtonProps) {
  const tEvent = useTranslations("event");
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [burst, setBurst] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const { isLoggedIn, loading } = useClientSession();

  useEffect(() => {
    setLiked(readLikes().has(eventId));
  }, [eventId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!loading && !isLoggedIn) {
      setShowLogin(true);
      return;
    }
    const set = readLikes();
    const wasLiked = set.has(eventId);
    if (wasLiked) {
      set.delete(eventId);
      setCount((c) => Math.max(0, c - 1));
    } else {
      set.add(eventId);
      setCount((c) => c + 1);
      setBurst((b) => b + 1);
      playClick();
    }
    writeLikes(set);
    setLiked(!wasLiked);
  }

  const iconSize = size === "lg" ? "size-5" : "size-4";

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={tEvent("favorite")}
        aria-pressed={liked}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full transition-colors",
          size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs",
          liked
            ? "bg-[var(--danger)]/12 text-[var(--danger)]"
            : "bg-[var(--background)]/90 backdrop-blur text-[var(--foreground)] hover:bg-[var(--muted-bg)]",
          className,
        )}
      >
        <motion.span
          key={burst}
          animate={liked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative inline-flex"
        >
          <Heart className={cn(iconSize, "transition-all", liked && "fill-current")} />
          <AnimatePresence>
            {liked && burst > 0 && (
              <motion.span
                key={`pulse-${burst}`}
                initial={{ scale: 0, opacity: 0.7 }}
                animate={{ scale: 2.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="absolute inset-0 rounded-full bg-[var(--danger)]/40 pointer-events-none"
              />
            )}
          </AnimatePresence>
        </motion.span>
        {showCount && <span className="tabular-nums font-medium">{count.toLocaleString("tr-TR")}</span>}
      </button>
      <LoginRequiredModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        title="Beğenmek için giriş gerekli"
        description="Beğendiğin etkinlikleri saklamak için MeydanFest hesabına ihtiyacın var."
      />
    </>
  );
}
