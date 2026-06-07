"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Dices, Sparkles } from "lucide-react";
import { RandomBuddyModal } from "@/components/RandomBuddyModal";

interface RandomBuddyButtonProps {
  className?: string;
  variant?: "primary" | "compact";
}

/** Cookie'den `meydanfest_city` çekme — FilterPanel ile aynı pattern. */
function readCityCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith("meydanfest_city="));
    if (!match) return undefined;
    const raw = match.split("=")[1];
    if (!raw) return undefined;
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

export function RandomBuddyButton({
  className = "",
  variant = "primary",
}: RandomBuddyButtonProps) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState<string | undefined>(undefined);

  useEffect(() => {
    setCity(readCityCookie());
  }, []);

  const isCompact = variant === "compact";

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(124, 58, 237, 0.35)",
            "0 0 0 10px rgba(124, 58, 237, 0)",
            "0 0 0 0 rgba(124, 58, 237, 0)",
          ],
        }}
        transition={{
          boxShadow: { duration: 2.4, repeat: Infinity, ease: "easeOut" },
          scale: { type: "spring", stiffness: 320, damping: 22 },
        }}
        className={
          isCompact
            ? `group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--primary)]/15 via-[var(--accent)]/15 to-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 px-4 py-2 text-xs sm:text-sm font-semibold hover:from-[var(--primary)] hover:to-[var(--accent)] hover:text-white transition-colors ${className}`
            : `group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--primary)] text-white px-5 py-3 text-sm sm:text-base font-semibold shadow-lg glow-primary hover:opacity-95 transition-opacity ${className}`
        }
        aria-label="Sürpriz biriyle eşleş"
      >
        {isCompact ? (
          <Dices className="size-4 group-hover:rotate-12 transition-transform" />
        ) : (
          <Sparkles className="size-4 group-hover:rotate-12 transition-transform" />
        )}
        Sürpriz biriyle eşleş
      </motion.button>

      <RandomBuddyModal open={open} onClose={() => setOpen(false)} city={city} />
    </>
  );
}
