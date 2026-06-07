"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, X, CalendarDays, Map, Lightbulb,
  LayoutDashboard, Code2, Award, PartyPopper, Film, GraduationCap,
} from "lucide-react";

// BottomNav'da olan (Anasayfa, Etkinlikler, +Aç, Yakınımda, Profil),
// FloatingChatBubble'da olan (Mesajlar), UserDropdown'da olan (Ayarlar)
// burada tekrar etmez.
const ITEMS = [
  { href: "/takvim",       icon: CalendarDays,    title: "Takvim",         desc: "Aylık görünüm" },
  { href: "/harita",       icon: Map,             title: "Harita",         desc: "Türkiye haritasında" },
  { href: "/hafta-sonu",   icon: PartyPopper,     title: "Hafta Sonu",     desc: "Cmt + Paz" },
  { href: "/kurslar",      icon: GraduationCap,   title: "Ücretsiz Kurslar", desc: "Belediye meslek/sanat" },
  { href: "/sinema",       icon: Film,            title: "Sinema",         desc: "Vizyondaki filmler" },
  { href: "/onerilen",     icon: Lightbulb,       title: "Önerilen",       desc: "Topluluk fikirleri" },
  { href: "/yillik-ozet",  icon: Award,           title: "Yıllık Özetim",  desc: "Etkinlik karnesi" },
  { href: "/api-docs",     icon: Code2,           title: "API",            desc: "Geliştiriciler için" },
  { href: "/admin",        icon: LayoutDashboard, title: "Yönetim",        desc: "Admin paneli" },
];

export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menü"
        title="Tüm sayfalar"
        className="grid place-items-center rounded-full border border-[var(--border)] size-9 hover:bg-[var(--muted-bg)] transition-colors"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute end-0 top-full mt-2 w-72 sm:w-80 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-2 z-50"
          >
            <div className="px-3 py-2 mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
              Tüm Sayfalar
            </div>
            <ul className="grid grid-cols-1 gap-0.5 max-h-[70vh] overflow-y-auto">
              {ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--muted-bg)] transition-colors"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
                      <item.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-[var(--muted)] truncate">{item.desc}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
