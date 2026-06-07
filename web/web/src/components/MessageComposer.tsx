"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { cn } from "@/lib/utils";
import { playSendSound } from "@/lib/sounds";

interface MessageComposerProps {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageComposer({ onSend, disabled, placeholder }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const ta = ref.current;
    if (!ta) {
      setText((t) => t + emoji);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    setText("");
    playSendSound();
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
      requestAnimationFrame(() => ref.current?.focus());
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = text.trim().length > 0 && !sending && !disabled;

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2">
      <EmojiPicker onSelect={insertEmoji} className="shrink-0" />
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        disabled={disabled}
        placeholder={placeholder ?? "Mesaj yaz..."}
        className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none placeholder:text-[var(--muted)] disabled:opacity-50 max-h-32"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label="Gönder"
        className={cn(
          "inline-flex items-center justify-center rounded-full size-9 shrink-0 transition-all",
          canSend
            ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 glow-primary"
            : "bg-[var(--muted-bg)] text-[var(--muted)] cursor-not-allowed",
        )}
      >
        <Send className="size-4 rtl:rotate-180" />
      </button>
    </div>
  );
}
