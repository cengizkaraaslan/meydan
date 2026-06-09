"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Loader2, Settings, User as UserIcon, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";

interface UserDropdownProps {
  name: string | null;
  image: string | null;
  email: string | null;
}

export function UserDropdown({ name, image, email }: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Çıkış: istemci tarafında anında loading göster, sonra çerezi temizleyip "/" e dön.
  // (Eski server-action formu tıklayınca menüyü kapatıp donuyordu → "bekliyor" hissi.)
  function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    void signOut({ callbackUrl: "/" });
  }

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

  const initial = (name ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Hesap menüsü"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-1.5 py-1 hover:bg-[var(--muted-bg)] hover:border-[var(--primary)]/40 transition-colors"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="size-7 rounded-full" />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white text-xs font-semibold">
            {initial}
          </span>
        )}
        <ChevronDown
          className={`size-3.5 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            role="menu"
            className="absolute end-0 top-full mt-2 w-60 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-2 z-50"
          >
            {(name || email) && (
              <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                {name && <div className="text-sm font-semibold truncate">{name}</div>}
                {email && (
                  <div className="text-xs text-[var(--muted)] truncate">{email}</div>
                )}
              </div>
            )}

            <Link
              href="/ayarlar/profil"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--muted-bg)] transition-colors text-sm"
            >
              <UserIcon className="size-4 text-[var(--primary)]" />
              Profilim
            </Link>

            <Link
              href="/ayarlar"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--muted-bg)] transition-colors text-sm"
            >
              <Settings className="size-4 text-[var(--muted)]" />
              Ayarlar
            </Link>

            <div className="my-1 border-t border-[var(--border)]" />

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--danger)]/10 transition-colors text-sm text-[var(--danger)] disabled:opacity-70 disabled:cursor-wait"
            >
              {loggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              {loggingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
