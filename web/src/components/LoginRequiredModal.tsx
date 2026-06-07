"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, Sparkles, X } from "lucide-react";

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  /** Kullanıcıya neden giriş gerektiğini söyler */
  title?: string;
  description?: string;
  /** Giriş sonrası yönlendirilecek path. Undefined → mevcut sayfa. */
  callbackUrl?: string;
}

export function LoginRequiredModal({
  open,
  onClose,
  title = "Giriş yapman gerekiyor",
  description = "Bu eylemi yapabilmek için MeydanFest hesabınla giriş yap. Saniyeler sürer.",
  callbackUrl,
}: LoginRequiredModalProps) {
  const pathname = usePathname();
  const target = callbackUrl ?? pathname ?? "/";
  const loginHref = `/giris?callbackUrl=${encodeURIComponent(target)}`;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/55 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
          >
            {/* Animasyonlu arka plan gradient */}
            <motion.div
              className="absolute -top-16 -right-16 size-56 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] opacity-25 blur-3xl pointer-events-none"
              animate={{ scale: [1, 1.15, 1], rotate: [0, 90, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-16 -left-16 size-56 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] opacity-20 blur-3xl pointer-events-none"
              animate={{ scale: [1.1, 1, 1.1], rotate: [180, 90, 180] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="absolute top-3 end-3 z-10 grid place-items-center size-8 rounded-full text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="size-4" />
            </button>

            <div className="relative p-6 sm:p-7 text-center">
              <motion.div
                initial={{ scale: 0.5, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-xl mb-4"
              >
                <Sparkles className="size-8" />
              </motion.div>

              <h2 className="text-xl font-bold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                {description}
              </p>

              <div className="mt-5 grid gap-2">
                <Link
                  href={loginHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-4 py-3 text-sm font-semibold shadow-lg glow-primary hover:opacity-95 transition-opacity"
                >
                  <LogIn className="size-4" />
                  Giriş yap / Kayıt ol
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors py-1"
                >
                  Şimdi değil
                </button>
              </div>

              <div className="mt-5 text-[10px] text-[var(--muted)] uppercase tracking-wider">
                Üye olmak ücretsiz · saniyeler sürer
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
