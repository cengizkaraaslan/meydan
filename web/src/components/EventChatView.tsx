"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import {
  fetchEventMessages,
  sendEventMessage,
} from "@/lib/event-chat-actions";
import type { EventChatMessage } from "@/lib/event-chat-store";
import { readProfile } from "@/lib/profile-types";

const CURRENT_USERNAME = "you";
const RSVP_LS_KEY = "es.event-rsvp";

interface EventChatViewProps {
  slug: string;
  eventTitle: string;
  attendeeCount: number;
  initialMessages: EventChatMessage[];
}

function readJoinedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(RSVP_LS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeJoinedSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RSVP_LS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function EventChatView({
  slug,
  eventTitle,
  attendeeCount,
  initialMessages,
}: EventChatViewProps) {
  const [messages, setMessages] = useState<EventChatMessage[]>(initialMessages);
  const [live, setLive] = useState(false);
  const [joined, setJoined] = useState(false);
  const [ownName, setOwnName] = useState("Sen");
  const [ownAvatar, setOwnAvatar] = useState<string | null>(null);
  const ownColor = "#7c3aed";
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalCount = useMemo(
    () => Math.max(attendeeCount, 1) + (joined ? 1 : 0),
    [attendeeCount, joined],
  );

  useEffect(() => {
    const p = readProfile();
    setOwnName(p.name || "Sen");
    setOwnAvatar(p.avatarUrl);
    setJoined(readJoinedSet().has(slug.toLowerCase()));

    function onStorage(e: StorageEvent) {
      if (e.key === RSVP_LS_KEY) {
        setJoined(readJoinedSet().has(slug.toLowerCase()));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // SSE bağlantısı — DM ile aynı pattern
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      es = new EventSource(
        `/api/events/${encodeURIComponent(slug)}/chat/stream`,
      );
      es.addEventListener("hello", () => setLive(true));
      es.addEventListener("ping", () => setLive(true));
      es.addEventListener("message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data) as EventChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const cleaned = prev.filter(
              (m) =>
                !(
                  m.id.startsWith("temp-") &&
                  m.senderUsername === msg.senderUsername &&
                  m.text === msg.text
                ),
            );
            return [...cleaned, msg];
          });
        } catch {
          // ignore parse errors
        }
      });
      es.onerror = () => {
        setLive(false);
        es?.close();
        if (!cancelled) setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [slug]);

  function handleJoin() {
    const set = readJoinedSet();
    set.add(slug.toLowerCase());
    writeJoinedSet(set);
    setJoined(true);
    toast.success("Sohbete katıldın 🎉");
  }

  async function handleSend(text: string) {
    if (!joined) {
      toast.error("Önce sohbete katılmalısın");
      return;
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: EventChatMessage = {
      id: tempId,
      senderUsername: CURRENT_USERNAME,
      senderName: ownName,
      senderColor: ownColor,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await sendEventMessage(slug, text, {
        name: ownName,
        color: ownColor,
      });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(res.error ?? "Mesaj gönderilemedi");
        return;
      }
      setMessages((prev) => {
        if (!res.message) return prev.filter((m) => m.id !== tempId);
        const exists = prev.some((m) => m.id === res.message!.id);
        const cleaned = prev.filter((m) => m.id !== tempId);
        return exists ? cleaned : [...cleaned, res.message];
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Mesaj gönderilemedi");
    }
  }

  // Hydration sırasında server'dan gelen seed ile farklı olursa diye
  // ilk render'da fetchEventMessages ile sync — uzun ömürlü dev sırasında işe yarar
  useEffect(() => {
    let cancelled = false;
    fetchEventMessages(slug)
      .then((res) => {
        if (cancelled) return;
        setMessages((prev) => {
          const merged = new Map<string, EventChatMessage>();
          for (const m of res.messages) merged.set(m.id, m);
          for (const m of prev) merged.set(m.id, m);
          return Array.from(merged.values()).sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime(),
          );
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="mx-auto max-w-3xl flex flex-col h-[calc(100vh-4rem-5rem)] md:h-[calc(100vh-4rem)] md:my-4 md:rounded-2xl md:border md:border-[var(--border)] bg-[var(--card)] md:overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur sticky top-0 z-10">
        <Link
          href={`/etkinlik/${slug}`}
          aria-label="Geri"
          className="inline-flex items-center justify-center size-9 rounded-full hover:bg-[var(--muted-bg)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{eventTitle}</div>
          <div className="text-xs text-[var(--muted)] inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {totalCount.toLocaleString("tr-TR")} kişi katılıyor
            </span>
            <span aria-hidden>•</span>
            {live ? (
              <span className="inline-flex items-center gap-0.5 text-[var(--success)]">
                <Wifi className="size-3" /> Canlı
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <WifiOff className="size-3" /> Bağlanıyor
              </span>
            )}
          </div>
        </div>
        {!joined && (
          <button
            type="button"
            onClick={handleJoin}
            className="shrink-0 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-3.5 py-1.5 text-xs font-semibold hover:opacity-95 transition-opacity glow-primary"
          >
            Sohbete katıl
          </button>
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-[var(--muted)]">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm">Bu sohbet boş</p>
              <p className="text-xs mt-1">İlk mesajı sen at.</p>
            </motion.div>
          </div>
        ) : (
          messages.map((m, i) => {
            const own = m.senderUsername === CURRENT_USERNAME;
            const authorName = own ? ownName : m.senderName;
            const avatarColor = own ? ownColor : m.senderColor;
            return (
              <div key={m.id} className="space-y-0.5">
                {!own && (
                  <div className="ms-9 text-[11px] font-medium text-[var(--muted)]">
                    {m.senderName}
                  </div>
                )}
                <MessageBubble
                  text={m.text}
                  own={own}
                  createdAt={new Date(m.createdAt)}
                  read={own}
                  index={Math.max(0, i - Math.max(0, messages.length - 12))}
                  authorName={authorName}
                  avatarUrl={own ? ownAvatar : null}
                  avatarColor={avatarColor}
                  showAvatar={true}
                />
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-3 border-t border-[var(--border)] bg-[var(--card)]">
        {joined ? (
          <MessageComposer
            onSend={handleSend}
            placeholder="Gruba yaz..."
          />
        ) : (
          <button
            type="button"
            onClick={handleJoin}
            className="w-full rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-3 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
          >
            Sohbete katıl & yazmaya başla
          </button>
        )}
      </div>
    </div>
  );
}
