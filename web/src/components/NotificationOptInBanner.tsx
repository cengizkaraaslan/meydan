"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { getPushStatus, subscribeToPush } from "@/lib/push-client";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "es.notif-dismissed";

export function NotificationOptInBanner() {
  const [visible, setVisible] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Aboneliği zaten reddetmiş kullanıcıya gösterme
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }

    // Sadece "default" iznine sahip ve push destekleyen tarayıcılarda göster
    const status = getPushStatus();
    if (status !== "default") return;

    // Hafif bir gecikme ile gir, sayfa ilk yüklenmesini bozma
    const t = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  function enable() {
    startTransition(async () => {
      const sub = await subscribeToPush();
      if (sub) {
        toast.success("Bildirimler açıldı");
        dismiss();
      } else if (getPushStatus() === "denied") {
        toast.error("Bildirim izni reddedildi.");
        dismiss();
      }
    });
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "fixed inset-x-3 z-40 mx-auto max-w-md rounded-2xl border border-[var(--border)]",
            "bg-[var(--card)]/95 backdrop-blur shadow-xl p-3.5",
            "bottom-24 md:bottom-6",
          )}
          role="region"
          aria-label="Bildirim açma teklifi"
        >
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Bell className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">🔔 Yeni etkinlikleri kaçırma</div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Konser, festival, tiyatro — istediğin kategoriyi seç, biz haber verelim.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={enable}
                  disabled={pending}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-xs font-medium hover:opacity-95 transition-opacity",
                    "disabled:opacity-50",
                  )}
                >
                  <Bell className="size-3.5" />
                  Bildirim Aç
                </button>
                <Link
                  href="/ayarlar/bildirimler"
                  onClick={dismiss}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline-offset-2 hover:underline"
                >
                  Kategori seç
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Kapat"
              className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--muted-bg)] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
