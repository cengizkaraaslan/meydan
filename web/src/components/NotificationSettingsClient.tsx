"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, BellRing, Check, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  updateCategoryPreferences,
  type PushPermissionStatus,
} from "@/lib/push-client";
import { CATEGORY_LABELS, type EventCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategory[];
const STORAGE_KEY = "es.notif-categories";
const EMAIL_PREF_KEY = "es.notif-prefs.email";

export function NotificationSettingsClient() {
  const [status, setStatus] = useState<PushPermissionStatus>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [categories, setCategories] = useState<EventCategory[]>(ALL_CATEGORIES);
  const [emailReminders, setEmailReminders] = useState(true);
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setStatus(getPushStatus());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EventCategory[];
        if (Array.isArray(parsed)) setCategories(parsed);
      }
      const emailRaw = localStorage.getItem(EMAIL_PREF_KEY);
      if (emailRaw !== null) {
        setEmailReminders(emailRaw === "true");
      }
    } catch {
      /* ignore */
    }
    // Mevcut subscription var mı?
    (async () => {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  function persistCategories(next: EventCategory[]) {
    setCategories(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (subscribed) {
      startTransition(async () => {
        await updateCategoryPreferences(next);
      });
    }
  }

  function toggleCategory(c: EventCategory) {
    const next = categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c];
    persistCategories(next);
  }

  function handleEnable() {
    startTransition(async () => {
      const sub = await subscribeToPush(categories);
      const next = getPushStatus();
      setStatus(next);
      if (sub) {
        setSubscribed(true);
        toast.success("Bildirimler açıldı");
      } else if (next === "denied") {
        toast.error("Bildirim izni reddedildi. Tarayıcı ayarlarından açabilirsin.");
      } else if (next === "unsupported") {
        toast.error("Tarayıcın web push'u desteklemiyor.");
      } else {
        toast.error("Bildirim açılamadı.");
      }
    });
  }

  function handleDisable() {
    startTransition(async () => {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.success("Bildirimler kapatıldı");
    });
  }

  function toggleEmailReminders() {
    const next = !emailReminders;
    setEmailReminders(next);
    try {
      localStorage.setItem(EMAIL_PREF_KEY, String(next));
    } catch {
      /* ignore */
    }
    toast.success(next ? "E-posta hatırlatıcı açıldı" : "E-posta hatırlatıcı kapatıldı");
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/push/test");
      const data = (await res.json()) as { delivered?: number; subscriber_count?: number };
      if ((data.delivered ?? 0) > 0) {
        toast.success(`Test bildirimi gönderildi (${data.delivered} alıcı)`);
      } else if ((data.subscriber_count ?? 0) === 0) {
        toast.error("Henüz hiç abone yok. Önce bildirimleri aç.");
      } else {
        toast.error("Bildirim gönderilemedi. VAPID env'leri kontrol et.");
      }
    } catch {
      toast.error("Test endpoint'i hata verdi.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PermissionBadge status={status} subscribed={subscribed} />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "grid size-12 place-items-center rounded-2xl",
              subscribed
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "bg-[var(--muted-bg)] text-[var(--muted)]",
            )}
          >
            {subscribed ? <BellRing className="size-6" /> : <Bell className="size-6" />}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">
              {subscribed ? "Bildirimler açık" : "Bildirimleri Aç"}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {subscribed
                ? "Seçtiğin kategorilerde yeni etkinlik eklendiğinde tarayıcına bildirim düşer."
                : "Yeni eklenen etkinliklerden anında haberdar ol. İstediğin zaman kapatabilirsin."}
            </p>
          </div>
          <motion.button
            type="button"
            onClick={subscribed ? handleDisable : handleEnable}
            disabled={pending || status === "unsupported" || status === "denied"}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              subscribed
                ? "border border-[var(--border)] hover:bg-[var(--muted-bg)]"
                : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : subscribed ? (
              <BellOff className="size-4" />
            ) : (
              <Bell className="size-4" />
            )}
            {subscribed ? "Kapat" : "Aç"}
          </motion.button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "grid size-12 place-items-center rounded-2xl",
              emailReminders
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "bg-[var(--muted-bg)] text-[var(--muted)]",
            )}
          >
            <Mail className="size-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">E-posta hatırlatıcı</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              RSVP verdiğin etkinliklerden bir gün önce e-posta ile hatırlatma al.
            </p>
          </div>
          <motion.button
            type="button"
            onClick={toggleEmailReminders}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              emailReminders
                ? "border border-[var(--border)] hover:bg-[var(--muted-bg)]"
                : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95",
            )}
          >
            {emailReminders ? <BellOff className="size-4" /> : <Bell className="size-4" />}
            {emailReminders ? "Kapat" : "Aç"}
          </motion.button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="font-semibold">Kategori tercihleri</h3>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Sadece seçtiğin kategorilerde bildirim al. Hiçbir şey seçmezsen hiç bildirim gelmez.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_CATEGORIES.map((c) => {
            const active = categories.includes(c);
            return (
              <motion.button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "relative inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] hover:bg-[var(--muted-bg)]",
                )}
              >
                <span className="font-medium">{CATEGORY_LABELS[c]}</span>
                {active && <Check className="size-4" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)]/30 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Test bildirimi</h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Bildirimlerin gerçekten geldiğinden emin olmak için bir test gönder.
            </p>
          </div>
          <motion.button
            type="button"
            onClick={handleTest}
            disabled={testing || !subscribed}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Gönder
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function PermissionBadge({
  status,
  subscribed,
}: {
  status: PushPermissionStatus;
  subscribed: boolean;
}) {
  const config: Record<PushPermissionStatus, { label: string; cls: string }> = {
    granted: {
      label: subscribed ? "İzin verildi • Abone" : "İzin verildi",
      cls: "bg-[var(--success)]/15 text-[var(--success)] ring-[var(--success)]/30",
    },
    default: {
      label: "Henüz izin verilmedi",
      cls: "bg-[var(--muted-bg)] text-[var(--muted)] ring-[var(--border)]",
    },
    denied: {
      label: "Reddedildi (tarayıcı ayarlarından aç)",
      cls: "bg-[var(--danger)]/15 text-[var(--danger)] ring-[var(--danger)]/30",
    },
    unsupported: {
      label: "Tarayıcın desteklemiyor",
      cls: "bg-[var(--muted-bg)] text-[var(--muted)] ring-[var(--border)]",
    },
  };
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full ring-1 px-3 py-1 text-xs font-medium",
        c.cls,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
}
