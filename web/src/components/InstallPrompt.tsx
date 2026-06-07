"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Download, Apple, Smartphone, Share2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const LS_KEY_DISMISSED = "meydanfest.installPrompt.dismissedAt";
const LS_KEY_SHOWN_COUNT = "meydanfest.installPrompt.shownCount";
const SHOW_AFTER_MS = 8_000; // sayfa açıldıktan sonra 8sn
const DISMISS_COOLDOWN_DAYS = 7;
const MAX_SHOW_COUNT = 4;

type Platform = "android" | "ios" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/mac|win|linux/.test(ua)) return "desktop";
  return "unknown";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari özel flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // zaten yüklü

    const p = detectPlatform();
    setPlatform(p);

    // Dismiss cooldown kontrol
    const dismissedAt = parseInt(
      localStorage.getItem(LS_KEY_DISMISSED) ?? "0",
      10,
    );
    const shownCount = parseInt(
      localStorage.getItem(LS_KEY_SHOWN_COUNT) ?? "0",
      10,
    );
    if (
      dismissedAt &&
      Date.now() - dismissedAt < DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    ) {
      return;
    }
    if (shownCount >= MAX_SHOW_COUNT) {
      return;
    }

    // Chrome/Edge beforeinstallprompt
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari'de beforeinstallprompt yok — gecikmeli göster
    const timer = setTimeout(() => {
      setShow(true);
      localStorage.setItem(LS_KEY_SHOWN_COUNT, String(shownCount + 1));
    }, SHOW_AFTER_MS);

    // Yükleme tamamlandı event'i
    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  }

  function dismiss() {
    setShow(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY_DISMISSED, String(Date.now()));
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-[400px] z-[60]"
        >
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            {/* Arka plan animasyonlu gradient blob */}
            <motion.div
              className="absolute -top-10 -right-10 size-40 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] opacity-20 blur-3xl"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />

            <button
              type="button"
              onClick={dismiss}
              aria-label="Kapat"
              className="absolute top-3 end-3 grid place-items-center size-7 rounded-full text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)] transition-colors z-10"
            >
              <X className="size-4" />
            </button>

            <div className="relative p-5">
              <div className="flex items-start gap-3 mb-3">
                <motion.div
                  animate={{ rotate: [0, -8, 8, -8, 0] }}
                  transition={{
                    duration: 1.4,
                    delay: 0.3,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                  className="shrink-0 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-lg"
                >
                  <Sparkles className="size-6" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">
                    MeydanFest&apos;i {platform === "ios" ? "Ana Ekrana" : "Telefonuna"} Ekle
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {platform === "ios"
                      ? "iPhone'unda uygulama gibi açılır"
                      : platform === "android"
                        ? "Android'de tek dokunuşla aç"
                        : "Tarayıcı olmadan, uygulama gibi aç"}
                  </div>
                </div>
              </div>

              {/* Faydaları */}
              <ul className="space-y-1.5 mb-4 text-xs">
                <Feature emoji="⚡" text="Anında açılır — tarayıcı yok" />
                <Feature emoji="🔔" text="Yeni etkinlikler için bildirim" />
                <Feature emoji="📶" text="Çevrimdışı bile gezilebilir" />
              </ul>

              {/* CTA */}
              {platform === "ios" ? (
                <IosInstructions />
              ) : deferred ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -1 }}
                  type="button"
                  disabled={installing}
                  onClick={handleInstall}
                  className="relative w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-4 py-3 text-sm font-semibold shadow-lg glow-primary disabled:opacity-60"
                >
                  <Download className="size-4" />
                  {installing ? "Yükleniyor..." : "Hemen yükle"}
                </motion.button>
              ) : platform === "android" ? (
                <AndroidInstructions />
              ) : (
                <DesktopInstructions />
              )}

              <button
                type="button"
                onClick={dismiss}
                className="mt-2 w-full text-center text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Şimdi değil
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Feature({ emoji, text }: { emoji: string; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden>{emoji}</span>
      <span className="text-[var(--muted)]">{text}</span>
    </li>
  );
}

function IosInstructions() {
  return (
    <div className="rounded-2xl bg-[var(--muted-bg)] p-3 text-xs space-y-2">
      <div className="font-semibold flex items-center gap-1.5">
        <Apple className="size-3.5" />
        iPhone&apos;da nasıl yüklenir
      </div>
      <ol className="space-y-1.5 text-[var(--muted)]">
        <li className="flex gap-1.5">
          <span className="font-bold text-[var(--foreground)]">1.</span>
          Safari&apos;de alt menüden <Share2 className="inline size-3.5 align-text-bottom" /> Paylaş&apos;a dokun
        </li>
        <li className="flex gap-1.5">
          <span className="font-bold text-[var(--foreground)]">2.</span>
          <span>&quot;Ana Ekrana Ekle&quot; seç</span>
        </li>
        <li className="flex gap-1.5">
          <span className="font-bold text-[var(--foreground)]">3.</span>
          <span>Sağ üstte &quot;Ekle&quot;ye dokun</span>
        </li>
      </ol>
    </div>
  );
}

function AndroidInstructions() {
  return (
    <div className="rounded-2xl bg-[var(--muted-bg)] p-3 text-xs space-y-2">
      <div className="font-semibold flex items-center gap-1.5">
        <Smartphone className="size-3.5" />
        Android&apos;de nasıl yüklenir
      </div>
      <p className="text-[var(--muted)]">
        Chrome&apos;da sağ üst menü (⋮) → <strong className="text-[var(--foreground)]">&quot;Uygulamayı yükle&quot;</strong>.
        Bazı tarayıcılarda &quot;Ana ekrana ekle&quot; olarak da görünür.
      </p>
    </div>
  );
}

function DesktopInstructions() {
  return (
    <div className="rounded-2xl bg-[var(--muted-bg)] p-3 text-xs">
      <p className="text-[var(--muted)]">
        Adres çubuğunun sağındaki <Download className="inline size-3.5 align-text-bottom" />{" "}
        <strong className="text-[var(--foreground)]">yükle</strong> ikonuna tıkla.
      </p>
    </div>
  );
}
