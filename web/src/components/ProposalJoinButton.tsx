"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "etkinlikscout:proposal-joins";

function readJoined(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeJoined(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function ProposalJoinButton({
  proposalId,
  baseCount,
  threshold,
}: {
  proposalId: string;
  baseCount: number;
  threshold: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    setMounted(true);
    setJoined(readJoined().has(proposalId));
  }, [proposalId]);

  const displayCount = baseCount + (joined ? 1 : 0);
  const pct = Math.min(100, Math.round((displayCount / threshold) * 100));
  const filled = displayCount >= threshold;

  function toggle() {
    const next = readJoined();
    if (next.has(proposalId)) {
      next.delete(proposalId);
      writeJoined(next);
      setJoined(false);
      toast("Katılımın geri alındı");
    } else {
      next.add(proposalId);
      writeJoined(next);
      setJoined(true);
      toast.success("Harika! Eşiğe ulaşılınca haber vereceğiz.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">
          <strong className="text-[var(--foreground)] tabular-nums">{displayCount}</strong>
          <span> / {threshold} katılımcı</span>
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            filled ? "text-[var(--success)]" : "text-[var(--foreground)]",
          )}
        >
          %{pct}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted-bg)]">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor: filled
              ? "var(--success)"
              : pct >= 80
                ? "var(--accent)"
                : "var(--primary)",
          }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <motion.button
        type="button"
        onClick={toggle}
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        disabled={!mounted}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60",
          joined
            ? "bg-[var(--success)]/15 text-[var(--success)] ring-1 ring-[var(--success)]/30"
            : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 glow-primary",
        )}
      >
        {joined ? (
          <>
            <Check className="size-4" />
            Katılıyorsun
          </>
        ) : (
          <>
            <UserPlus className="size-4" />
            Ben de katılırım
          </>
        )}
      </motion.button>

      <p className="text-[11px] text-center text-[var(--muted)]">
        Katılımın bu tarayıcıda saklanır. Eşik dolarsa öneri gerçek etkinliğe dönüşür.
      </p>
    </div>
  );
}
