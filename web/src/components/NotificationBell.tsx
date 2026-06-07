"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  Heart,
  Calendar,
  UserPlus,
  Trash2,
  X,
} from "lucide-react";
import {
  dismissNotificationAction,
  fetchNotificationsAction,
  markAllReadAction,
  markReadAction,
} from "@/lib/notifications-actions";
import type { Notification, NotificationType } from "@/lib/notifications-store";

const ICON: Record<NotificationType, typeof Bell> = {
  message: MessageSquare,
  comment_reply: MessageSquare,
  comment_like: Heart,
  rsvp_reminder: Calendar,
  new_follower: UserPlus,
  event_update: Calendar,
  report_resolved: Check,
  system: Bell,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes}dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g`;
  return `${Math.floor(days / 30)}ay`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  function refresh() {
    setLoading(true);
    fetchNotificationsAction()
      .then((res) => {
        setItems(res.items);
        setUnread(res.unread);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggle() {
    if (!open) refresh();
    setOpen((o) => !o);
  }

  function handleItemClick(n: Notification) {
    if (!n.read) {
      startTransition(async () => {
        await markReadAction(n.id);
      });
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
  }

  function handleMarkAll() {
    startTransition(async () => {
      const res = await markAllReadAction();
      if (res.ok) {
        setItems((prev) => prev.map((x) => ({ ...x, read: true })));
        setUnread(0);
      }
    });
  }

  function handleDismiss(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      await dismissNotificationAction(id);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Bildirimler"
        title="Bildirimler"
        className="relative grid place-items-center rounded-full border border-[var(--border)] size-9 hover:bg-[var(--muted-bg)] transition-colors"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -end-1 grid place-items-center min-w-[18px] h-[18px] rounded-full bg-[var(--danger)] text-white text-[10px] font-bold px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="fixed sm:absolute inset-x-4 top-[4.5rem] sm:inset-x-auto sm:top-full sm:end-0 sm:mt-2 sm:w-96 w-auto max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div className="font-semibold text-sm flex items-center gap-2">
                Bildirimler
                {unread > 0 && (
                  <span className="rounded-full bg-[var(--danger)]/15 text-[var(--danger)] text-[10px] px-2 py-0.5 font-semibold">
                    {unread} yeni
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                >
                  <CheckCheck className="size-3.5" />
                  Hepsini okundu işaretle
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  Yükleniyor…
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="text-3xl mb-2">🔔</div>
                  <div className="text-sm text-[var(--muted)]">
                    Henüz bildirimin yok.
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {items.map((n) => {
                    const Icon = ICON[n.type] ?? Bell;
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.url}
                          onClick={() => handleItemClick(n)}
                          className={`group block px-4 py-3 hover:bg-[var(--muted-bg)] transition-colors ${
                            !n.read ? "bg-[var(--primary)]/5" : ""
                          }`}
                        >
                          <div className="flex gap-3">
                            <span
                              className="grid size-9 place-items-center rounded-full shrink-0"
                              style={{
                                background: n.fromColor
                                  ? n.fromColor
                                  : "var(--muted-bg)",
                                color: n.fromColor ? "#fff" : "var(--primary)",
                              }}
                            >
                              <Icon className="size-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="text-sm font-medium truncate">
                                  {n.title}
                                </div>
                                <div className="text-[10px] text-[var(--muted)] whitespace-nowrap">
                                  {relativeTime(n.createdAt)}
                                </div>
                              </div>
                              <div className="text-xs text-[var(--muted)] line-clamp-2 mt-0.5">
                                {n.body}
                              </div>
                            </div>
                            {!n.read && (
                              <span
                                aria-label="Okunmadı"
                                className="size-2 rounded-full bg-[var(--primary)] mt-2 shrink-0"
                              />
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDismiss(e, n.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted)] hover:text-[var(--danger)]"
                              aria-label="Kapat"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-4 py-2 border-t border-[var(--border)] text-center">
              <Link
                href="/ayarlar/bildirimler"
                onClick={() => setOpen(false)}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Bildirim ayarları →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
