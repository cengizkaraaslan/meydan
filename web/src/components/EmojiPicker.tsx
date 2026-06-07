"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: "Yüz", icon: "😀",
    emojis: ["😀","😂","🤣","😊","🥰","😍","🤩","😎","🤔","🙄","😴","😭","😡","🤯","🥳","🤗","😏","😜","🤪","🥶","🤤","😇","🙂","🤐"],
  },
  {
    name: "Kalp", icon: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"],
  },
  {
    name: "El", icon: "👋",
    emojis: ["👋","🤚","✋","🖐️","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","👊","✊","🤛","🤜","👏","🙌","👐","🤲","🙏"],
  },
  {
    name: "Eğlence", icon: "🎉",
    emojis: ["🎉","🎊","🎈","🎁","🎂","🎄","🎃","🎀","🎗️","🎟️","🎫","🎖️","🏆","🥇","🥈","🥉","🏅","🎯","🎲","🃏","🎴","🎮","🕹️","🎰"],
  },
  {
    name: "Müzik", icon: "🎵",
    emojis: ["🎵","🎶","🎤","🎧","🎷","🎸","🎹","🎺","🎻","🥁","🪕","🪗","📻","🎼","🔉","🔊","💃","🕺"],
  },
  {
    name: "Yemek", icon: "🍔",
    emojis: ["🍔","🍕","🌭","🍟","🌮","🥗","🍣","🍜","🍝","🥘","🍱","🥟","🍤","🍿","🍩","🍪","🧁","🍰","🎂","🍫","🍬","🍭","🍦","☕","🍵","🥤","🍺","🍷","🥂"],
  },
  {
    name: "Spor", icon: "⚽",
    emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🎱","🪀","🏓","🏸","🥊","🥋","⛸️","🛹","🛷","🥇","🥈","🥉","🏆","🎖️"],
  },
];

export function EmojiPicker({ onSelect, className }: { onSelect: (emoji: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Emoji ekle"
        className="inline-flex items-center justify-center rounded-lg size-8 hover:bg-[var(--muted-bg)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <Smile className="size-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 start-0 z-50 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl w-[300px] overflow-hidden"
          >
            <div className="flex items-center gap-1 p-2 border-b border-[var(--border)] overflow-x-auto no-scrollbar">
              {EMOJI_CATEGORIES.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setTab(i)}
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-1 text-base transition-colors",
                    tab === i ? "bg-[var(--primary)]/12 ring-1 ring-[var(--primary)]/30" : "hover:bg-[var(--muted-bg)]",
                  )}
                  aria-label={c.name}
                >
                  {c.icon}
                </button>
              ))}
            </div>
            <div className="p-2 grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
              {EMOJI_CATEGORIES[tab].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className="size-9 rounded-lg text-xl hover:bg-[var(--muted-bg)] transition-colors"
                  aria-label={`Emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
