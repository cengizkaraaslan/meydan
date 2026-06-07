"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { BlockReportMenu } from "./BlockReportMenu";
import { Avatar } from "@/components/ui/Avatar";
import { playReceiveSound } from "@/lib/sounds";
import {
  markReadAction,
  sendMessageAction,
  type SerializedMessage,
} from "@/lib/messaging-actions";
import { readProfile } from "@/lib/profile-types";

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

const CURRENT_USERNAME = "you";

interface ConversationViewProps {
  partner: { username: string; name: string; color: string; bio: string; avatarUrl?: string };
  initialMessages: SerializedMessage[];
}

export function ConversationView({ partner, initialMessages }: ConversationViewProps) {
  const [messages, setMessages] = useState<SerializedMessage[]>(initialMessages);
  const [blocked, setBlocked] = useState(false);
  const [live, setLive] = useState(false);
  const [ownAvatar, setOwnAvatar] = useState<string | null>(null);
  const [ownName, setOwnName] = useState("Sen");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = readProfile();
    setOwnAvatar(p.avatarUrl);
    setOwnName(p.name || "Sen");
  }, []);

  useEffect(() => {
    setBlocked(readBlocks().has(partner.username));
    function onStorage(e: StorageEvent) {
      if (e.key === LS_KEY) setBlocked(readBlocks().has(partner.username));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [partner.username]);

  useEffect(() => {
    markReadAction(partner.username).catch(() => {});
  }, [partner.username]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // SSE: canlı mesaj akışı (polling yerine)
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      es = new EventSource(`/api/messages/stream?username=${encodeURIComponent(partner.username)}`);
      es.addEventListener("hello", () => setLive(true));
      es.addEventListener("ping", () => setLive(true));
      es.addEventListener("message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data) as SerializedMessage;
          let isIncoming = false;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const cleaned = prev.filter(
              (m) => !(m.id.startsWith("temp-") && m.senderUsername === msg.senderUsername && m.text === msg.text),
            );
            // Karşı taraftan geldi mi? (kendimden değil)
            if (msg.senderUsername !== CURRENT_USERNAME) {
              isIncoming = true;
            }
            return [...cleaned, msg];
          });
          if (isIncoming) playReceiveSound();
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
  }, [partner.username]);

  async function handleSend(text: string) {
    if (blocked) {
      toast.error("Engellediğin kullanıcıya mesaj gönderemezsin");
      return;
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: SerializedMessage = {
      id: tempId,
      senderUsername: CURRENT_USERNAME,
      text,
      createdAt: new Date().toISOString(),
      readAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await sendMessageAction(partner.username, text);
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

  return (
    <div className="mx-auto max-w-3xl flex flex-col h-[calc(100vh-4rem-5rem)] md:h-[calc(100vh-4rem)] md:my-4 md:rounded-2xl md:border md:border-[var(--border)] bg-[var(--card)] md:overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur sticky top-0 z-10">
        <Link
          href="/mesaj"
          aria-label="Geri"
          className="inline-flex items-center justify-center size-9 rounded-full hover:bg-[var(--muted-bg)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)] md:hidden"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <Link href={`/profil/${partner.username}`} className="flex items-center gap-3 min-w-0 flex-1 group">
          <div className="relative shrink-0">
            <Avatar
              src={partner.avatarUrl}
              name={partner.name}
              color={partner.color}
              size="size-10"
              className="shadow-sm"
            />
            <span
              aria-hidden
              className={`absolute -bottom-0.5 -end-0.5 size-3 rounded-full ring-2 ring-[var(--card)] ${
                live ? "bg-[var(--success)]" : "bg-[var(--muted)]"
              }`}
              title={live ? "Canlı bağlı" : "Bağlanıyor"}
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate group-hover:text-[var(--primary)] transition-colors">
              {partner.name}
            </div>
            <div className="text-xs text-[var(--muted)] truncate inline-flex items-center gap-1">
              @{partner.username} •
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
        </Link>
        <BlockReportMenu username={partner.username} displayName={partner.name} onBlockChange={setBlocked} />
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-[var(--muted)]">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <p className="text-sm">Henüz mesaj yok</p>
              <p className="text-xs mt-1">İlk mesajı sen yaz.</p>
            </motion.div>
          </div>
        ) : (
          messages.map((m, i) => {
            const own = m.senderUsername === CURRENT_USERNAME;
            return (
              <MessageBubble
                key={m.id}
                text={m.text}
                own={own}
                createdAt={new Date(m.createdAt)}
                read={Boolean(m.readAt)}
                index={Math.max(0, i - Math.max(0, messages.length - 12))}
                authorName={own ? ownName : partner.name}
                avatarUrl={own ? ownAvatar : null}
                avatarColor={own ? "#7c3aed" : partner.color}
              />
            );
          })
        )}
      </div>

      <div className="px-3 py-3 border-t border-[var(--border)] bg-[var(--card)]">
        {blocked ? (
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)] text-center">
            Bu kullanıcıyı engelledin. Mesaj gönderemezsin.
          </div>
        ) : (
          <MessageComposer onSend={handleSend} placeholder={`@${partner.username}'a mesaj yaz...`} />
        )}
      </div>
    </div>
  );
}
