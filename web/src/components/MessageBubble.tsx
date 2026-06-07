"use client";

import { motion } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Match strings that consist purely of one or more emojis (no letters/digits).
function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const stripped = trimmed.replace(
    /[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}\s]/gu,
    "",
  );
  return stripped.length === 0;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export interface MessageBubbleProps {
  text: string;
  own: boolean;
  createdAt: Date;
  read?: boolean;
  index?: number;
  /** Avatar üzerinde gösterilecek isim (baş harfi için) */
  authorName?: string;
  /** Avatar resmi URL'i — yoksa baş harf + renkli daire */
  avatarUrl?: string | null;
  /** Avatar fallback rengi */
  avatarColor?: string;
  /** Avatar göster (false ise sadece bubble) */
  showAvatar?: boolean;
}

export function MessageBubble({
  text, own, createdAt, read, index = 0,
  authorName = "?", avatarUrl, avatarColor = "#7c3aed", showAvatar = true,
}: MessageBubbleProps) {
  const emojiOnly = isEmojiOnly(text);
  const Avatar = (
    <span className={cn(
      "shrink-0 size-7 grid place-items-center rounded-full overflow-hidden text-white text-xs font-semibold ring-2 ring-[var(--card)]",
    )}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={authorName} className="w-full h-full object-cover" />
      ) : (
        <span className="grid place-items-center w-full h-full" style={{ background: avatarColor }}>
          {authorName.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay: Math.min(index * 0.03, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn("flex w-full items-end gap-2", own ? "justify-end" : "justify-start")}
    >
      {!own && showAvatar && Avatar}
      <div
        className={cn(
          "max-w-[74%] sm:max-w-[62%] rounded-2xl px-3.5 py-2 break-words shadow-sm",
          own
            ? "bg-[var(--primary)] text-[var(--primary-foreground)] rounded-br-md"
            : "bg-[var(--muted-bg)] text-[var(--foreground)] rounded-bl-md",
          emojiOnly && "bg-transparent shadow-none px-1 py-0.5",
        )}
      >
        <p
          className={cn(
            "whitespace-pre-wrap leading-relaxed",
            emojiOnly ? "text-4xl sm:text-5xl" : "text-sm",
          )}
        >
          {text}
        </p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            own
              ? "justify-end text-[var(--primary-foreground)]/75"
              : "justify-start text-[var(--muted)]",
            emojiOnly && "text-[var(--muted)] justify-end",
          )}
        >
          <span>{formatTime(createdAt)}</span>
          {own && !emojiOnly && (
            read ? <CheckCheck className="size-3" /> : <Check className="size-3" />
          )}
        </div>
      </div>
      {own && showAvatar && Avatar}
    </motion.div>
  );
}
