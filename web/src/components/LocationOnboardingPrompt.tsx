"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { findClosestCity } from "@/lib/city-geo";
import { useClientSession } from "@/lib/use-session";
import { cityLocativeKi } from "@/lib/utils";

const LS_KEY_RESULT = "meydanfest.location.resolvedCity";
const LS_KEY_DISMISSED = "meydanfest.location.dismissedAt";
const LS_KEY_FIRST_SEEN = "meydanfest.location.firstSeenAt";
const DISMISS_COOLDOWN_DAYS = 30;
const SHOW_DELAY_MS = 3_000; // login sonrası 3 saniye

/**
 * Giriş yapan kullanıcılara konum izni ister.
 * - Sadece bir kez gösterir (cooldown 30 gün veya çözüm bulundu)
 * - Sayfa açıldıktan ~3sn sonra animasyonla iner
 * - Reddedildi olarak işaretlenirse 30 gün boyunca tekrar göstermez
 */
export function LocationOnboardingPrompt() {
  const { isLoggedIn, loading } = useClientSession();
  const [show, setShow] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (loading || !isLoggedIn) return;
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) return;

    // Daha önce çözülmüşse gösterme
    if (localStorage.getItem(LS_KEY_RESULT)) return;

    // Cooldown
    const dismissedAt = parseInt(localStorage.getItem(LS_KEY_DISMISSED) ?? "0", 10);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_DAYS * 86_400_000) {
      return;
    }

    if (!localStorage.getItem(LS_KEY_FIRST_SEEN)) {
      localStorage.setItem(LS_KEY_FIRST_SEEN, String(Date.now()));
    }

    const t = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [loading, isLoggedIn]);

  function allow() {
    setResolving(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const closest = findClosestCity(pos.coords.latitude, pos.coords.longitude);
        setResolving(false);
        if (!closest) {
          toast.error("Konum tespit edilemedi");
          return;
        }
        localStorage.setItem(LS_KEY_RESULT, closest.city);
        // Server-side okuma için cookie de set et
        document.cookie = `meydanfest_city=${encodeURIComponent(closest.city)}; path=/; max-age=31536000; samesite=lax`;
        toast.success(`📍 ${closest.city} olarak kaydedildi`);
        setShow(false);
        // Yakınımdaki sayfasına yönlendirme önerisi
        setTimeout(() => {
          if (confirm(`${cityLocativeKi(closest.city)} etkinlikleri şimdi gösterelim mi?`)) {
            window.location.href = `/etkinlikler?city=${encodeURIComponent(closest.city)}`;
          }
        }, 400);
      },
      (err) => {
        setResolving(false);
        if (err.code === err.PERMISSION_DENIED) {
          localStorage.setItem(LS_KEY_DISMISSED, String(Date.now()));
          toast.error("İzin verilmedi");
        } else {
          toast.error("Konum alınamadı");
        }
        setShow(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY_DISMISSED, String(Date.now()));
    }
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-[400px] z-[55]"
        >
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <motion.div
              className="absolute -top-12 -right-12 size-40 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] opacity-20 blur-3xl pointer-events-none"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />

            <button
              type="button"
              onClick={dismiss}
              aria-label="Kapat"
              className="absolute top-3 end-3 z-10 grid place-items-center size-7 rounded-full text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)]"
            >
              <X className="size-4" />
            </button>

            <div className="relative p-5">
              <div className="flex items-start gap-3 mb-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="shrink-0 grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-lg"
                >
                  <MapPin className="size-5" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">Konumunu paylaş</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    Sana en yakın etkinlikleri ve buddy'leri gösterelim.
                  </div>
                </div>
              </div>

              <ul className="space-y-1 mb-4 text-xs">
                <li className="flex items-center gap-2">
                  <Sparkles className="size-3 text-[var(--primary)]" />
                  <span className="text-[var(--muted)]">Yakındaki festivalleri keşfet</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="size-3 text-[var(--accent)]" />
                  <span className="text-[var(--muted)]">Şehrinde etkinlik arkadaşı bul</span>
                </li>
              </ul>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
                >
                  Şimdi değil
                </button>
                <button
                  type="button"
                  onClick={allow}
                  disabled={resolving}
                  className="rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-3 py-2 text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-60"
                >
                  {resolving ? "Bekle..." : "Konuma izin ver"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
