"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { MessageCircle, X, ArrowRight, Send } from "lucide-react";
import { fetchNotificationsAction } from "@/lib/notifications-actions";
import { useClientSession } from "@/lib/use-session";

const LS_POSITION = "meydanfest.chat.bubble.pos";
const LS_DISMISSED_PROMPT = "meydanfest.chat.bubble.promptDismissed";

interface PreviewMessage {
  id: string;
  from: string;
  text: string;
  time: string;
  unread: boolean;
}

/**
 * Sağ alt köşede sabit duran sürüklenebilir sohbet balonu.
 * Tıklanınca son mesajları ve sohbet kısayollarını gösterir.
 * Konumu localStorage'da saklanır.
 */
export function FloatingChatBubble() {
  const { isLoggedIn, loading } = useClientSession();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [previews, setPreviews] = useState<PreviewMessage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // motion values — drag state'i React state'i ile değil framer'in
  // kendi reactive değerleriyle yönet (animate prop'u ile çakışmaz).
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // localStorage'dan eski pozisyon — motion value'ları doldur
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LS_POSITION);
      if (raw) {
        const pos = JSON.parse(raw) as { x: number; y: number };
        if (typeof pos.x === "number") x.set(pos.x);
        if (typeof pos.y === "number") y.set(pos.y);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bildirimleri çek — mesajları filtrele
  useEffect(() => {
    if (loading || !isLoggedIn) return;
    let cancelled = false;
    function refresh() {
      fetchNotificationsAction()
        .then((res) => {
          if (cancelled) return;
          const messageNotifs = res.items.filter(
            (n) => n.type === "message" || n.type === "comment_reply",
          );
          const items: PreviewMessage[] = messageNotifs.slice(0, 5).map((n) => ({
            id: n.id,
            from: n.fromName ?? "Biri",
            text: n.body,
            time: relativeTime(n.createdAt),
            unread: !n.read,
          }));
          setPreviews(items);
          setUnread(items.filter((m) => m.unread).length);
        })
        .catch(() => {});
    }
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loading, isLoggedIn]);

  function savePosition() {
    try {
      localStorage.setItem(
        LS_POSITION,
        JSON.stringify({ x: x.get(), y: y.get() }),
      );
    } catch {
      // ignore
    }
  }

  // Giriş yapmamışsa veya yüklenirken hiçbir şey gösterme
  if (loading || !isLoggedIn) return null;

  return (
    <>
      {/* drag sınırı için fixed overlay (görünmez) */}
      <div
        ref={constraintsRef}
        className="pointer-events-none fixed inset-0 z-[58]"
        aria-hidden
      />

      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        dragElastic={0.06}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
          savePosition();
          // tap'ten ayır — kısa gecikme sonrası izin ver
          setTimeout(() => setIsDragging(false), 50);
        }}
        style={{ x, y, touchAction: "none" }}
        whileDrag={{ scale: 1.08, cursor: "grabbing" }}
        className="fixed bottom-24 start-4 lg:bottom-6 lg:end-6 lg:start-auto z-[59] cursor-grab"
      >
        {/* Drag tutamacı — gorsel ipucu */}
        <span
          aria-hidden
          className="absolute -top-2 start-1/2 -translate-x-1/2 block w-7 h-1 rounded-full bg-[var(--muted)]/40 shadow-sm pointer-events-none"
        />

        {/* Toggle button — drag bittikten sonra tıklamaya izin ver */}
        <motion.button
          type="button"
          onClick={() => {
            if (isDragging) return;
            setOpen((o) => !o);
          }}
          whileTap={{ scale: 0.93 }}
          whileHover={{ y: -2 }}
          aria-label={open ? "Sohbeti kapat" : "Sohbet"}
          className="relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-2xl glow-primary"
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="size-6" />
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <MessageCircle className="size-6" />
              </motion.span>
            )}
          </AnimatePresence>
          {!open && unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -end-1 grid place-items-center min-w-[22px] h-[22px] rounded-full bg-[var(--danger)] text-white text-[11px] font-bold ring-2 ring-[var(--background)] px-1"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
          {!open && unread > 0 && (
            // pulse halka
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--primary)] -z-10"
              animate={{ scale: [1, 1.45, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </motion.button>

        {/* Mini chat paneli */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-full start-0 lg:start-auto lg:end-0 mb-3 w-[300px] sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
            >
              <header className="flex items-center justify-between gap-2 p-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/8 to-[var(--accent)]/8">
                <div>
                  <div className="font-semibold text-sm">Mesajlar</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {previews.length === 0
                      ? "Henüz yeni mesaj yok"
                      : `${previews.length} sohbet`}
                  </div>
                </div>
                <Link
                  href="/mesaj"
                  onClick={() => setOpen(false)}
                  className="text-xs text-[var(--primary)] inline-flex items-center gap-0.5 hover:underline"
                >
                  Tümü
                  <ArrowRight className="size-3 rtl:rotate-180" />
                </Link>
              </header>

              <div className="max-h-[280px] overflow-y-auto">
                {previews.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="text-3xl mb-2">💬</div>
                    <div className="text-sm text-[var(--muted)]">
                      Henüz sohbet yok.
                    </div>
                    <Link
                      href="/yakinimda"
                      onClick={() => setOpen(false)}
                      className="mt-3 inline-block text-xs text-[var(--primary)] hover:underline"
                    >
                      Yakındaki insanları bul →
                    </Link>
                  </div>
                ) : (
                  <ul>
                    {previews.map((m) => (
                      <li key={m.id}>
                        <Link
                          href="/mesaj"
                          onClick={() => setOpen(false)}
                          className={`flex gap-3 px-4 py-3 hover:bg-[var(--muted-bg)] transition-colors ${
                            m.unread ? "bg-[var(--primary)]/5" : ""
                          }`}
                        >
                          <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white text-xs font-semibold shrink-0">
                            {m.from.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-sm font-medium truncate">
                                {m.from}
                              </div>
                              <div className="text-[10px] text-[var(--muted)] whitespace-nowrap">
                                {m.time}
                              </div>
                            </div>
                            <div className="text-xs text-[var(--muted)] truncate mt-0.5">
                              {m.text}
                            </div>
                          </div>
                          {m.unread && (
                            <span className="size-2 rounded-full bg-[var(--primary)] mt-2 shrink-0" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="px-4 py-3 border-t border-[var(--border)]">
                <Link
                  href="/mesaj"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity"
                >
                  <Send className="size-4" />
                  Mesajlara git
                </Link>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
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

void LS_DISMISSED_PROMPT;
