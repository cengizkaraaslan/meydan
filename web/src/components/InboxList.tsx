"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

export interface InboxItem {
  username: string;
  name: string;
  color: string;
  avatarUrl?: string;
  lastMessageText: string;
  lastMessageAt: string; // ISO
  lastMessageFromMe: boolean;
  unreadCount: number;
}

const LS_KEY = "es.blocks";

function readBlocks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes}dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g`;
  return `${Math.floor(days / 7)}h`;
}

export function InboxList({ items, activeUsername }: { items: InboxItem[]; activeUsername?: string }) {
  const [q, setQ] = useState("");
  const [blocks, setBlocks] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBlocks(readBlocks());
    function onStorage(e: StorageEvent) {
      if (e.key === LS_KEY) setBlocks(readBlocks());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((it) => !blocks.has(it.username))
      .filter((it) => {
        if (!query) return true;
        return (
          it.name.toLowerCase().includes(query) ||
          it.username.toLowerCase().includes(query) ||
          it.lastMessageText.toLowerCase().includes(query)
        );
      });
  }, [items, q, blocks]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-[var(--background)]/95 backdrop-blur px-4 py-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted)]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mesajlarda ara..."
            className="w-full rounded-full border border-[var(--border)] bg-[var(--muted-bg)]/50 ps-10 pe-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 text-[var(--muted)]">
          <Inbox className="size-10 mb-3 opacity-50" />
          <p className="text-sm">
            {q.trim() ? "Eşleşen sohbet yok" : "Henüz mesajın yok"}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {filtered.map((it, i) => {
            const isActive = activeUsername === it.username;
            return (
              <motion.li
                key={it.username}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.3) }}
              >
                <Link
                  href={`/mesaj/${it.username}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors",
                    isActive
                      ? "bg-[var(--primary)]/10"
                      : "hover:bg-[var(--muted-bg)]",
                  )}
                >
                  <Avatar
                    src={it.avatarUrl}
                    name={it.name}
                    color={it.color}
                    size="size-12"
                    className="shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate",
                          it.unreadCount > 0 ? "font-semibold" : "font-medium",
                        )}
                      >
                        {it.name}
                      </span>
                      <span className="text-[11px] text-[var(--muted)] shrink-0">
                        {relativeTime(it.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span
                        className={cn(
                          "text-xs truncate",
                          it.unreadCount > 0
                            ? "text-[var(--foreground)] font-medium"
                            : "text-[var(--muted)]",
                        )}
                      >
                        {it.lastMessageFromMe ? "Sen: " : ""}
                        {it.lastMessageText || "Mesaj yok"}
                      </span>
                      {it.unreadCount > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-bold">
                          {it.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
