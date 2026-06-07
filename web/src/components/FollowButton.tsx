"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClientSession } from "@/lib/use-session";
import { LoginRequiredModal } from "./LoginRequiredModal";

const LS_KEY = "es.follows";

function readFollows(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeFollows(set: Set<string>) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch {}
}

export function FollowButton({ username, displayName }: { username: string; displayName: string }) {
  const [following, setFollowing] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const { isLoggedIn, loading } = useClientSession();

  useEffect(() => {
    setFollowing(readFollows().has(username));
  }, [username]);

  function toggle() {
    if (!loading && !isLoggedIn) {
      setShowLogin(true);
      return;
    }
    const set = readFollows();
    if (set.has(username)) {
      set.delete(username);
      setFollowing(false);
      toast.success(`${displayName} takipten çıkarıldı`);
    } else {
      set.add(username);
      setFollowing(true);
      toast.success(`${displayName} takip ediliyor`);
    }
    writeFollows(set);
  }

  const label = following ? (hovering ? "Takipten Çık" : "Takip Ediliyor") : "Takip Et";

  return (
    <>
      <motion.button
        type="button"
        onClick={toggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
          following
            ? hovering
              ? "bg-[var(--danger)]/15 text-[var(--danger)] ring-1 ring-[var(--danger)]/30"
              : "bg-[var(--muted-bg)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
            : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 glow-primary",
        )}
      >
        {following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
        {label}
      </motion.button>
      <LoginRequiredModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        title="Takip etmek için giriş gerekli"
        description={`${displayName} kullanıcısını takip etmek için MeydanFest hesabına ihtiyacın var.`}
      />
    </>
  );
}
