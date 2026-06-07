"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, ArrowRight, Calendar, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EventListItem } from "@/lib/types";
import { formatEventDate, formatShortDate, cityLocativeKi } from "@/lib/utils";
import { Badge } from "./ui/Badge";

interface CityEventsPanelProps {
  /** Açık şehir adı — null → panel kapalı */
  city: string | null;
  /** Şehre ait etkinlikler (önceden filtrelenmiş) */
  events: EventListItem[];
  /** Panel kapatma callback */
  onClose: () => void;
  /** "Tüm etkinlikleri gör" tıklandığında çalışır */
  onSeeAll: (cityName: string) => void;
}

/**
 * Sağda (desktop, sm+) veya alttan (mobile) açılan etkinlik listesi paneli.
 * Backdrop click, X tuşu ve Escape ile kapanır.
 */
export function CityEventsPanel({ city, events, onClose, onSeeAll }: CityEventsPanelProps) {
  const tCat = useTranslations("categories");

  // Escape ile kapat + scroll kilidi
  useEffect(() => {
    if (!city) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [city, onClose]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [events],
  );

  const freeCount = sortedEvents.filter((e) => e.isFree).length;

  return (
    <AnimatePresence>
      {city && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm flex sm:items-stretch sm:justify-end items-end"
          aria-modal="true"
          role="dialog"
          aria-label={`${city} etkinlikleri`}
        >
          <motion.aside
            key="panel"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: "100%", x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={[
              "w-full sm:w-[420px] md:w-[460px]",
              "h-[88vh] sm:h-full",
              "bg-[var(--card)] border-t sm:border-t-0 sm:border-s border-[var(--border)]",
              "rounded-t-3xl sm:rounded-none",
              "shadow-2xl flex flex-col",
            ].join(" ")}
            // Desktop'ta sağdan kayma efekti için ayrıca x animasyonu (CSS responsive bağımlı yapamıyoruz; mobile y, desktop için yeterli)
            style={{ willChange: "transform" }}
          >
            {/* Drag handle (sadece mobile) */}
            <div className="sm:hidden pt-2 pb-1 grid place-items-center">
              <span className="inline-block h-1.5 w-12 rounded-full bg-[var(--border)]" />
            </div>

            {/* Header */}
            <header className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5 pb-3 border-b border-[var(--border)]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-[var(--primary)] shrink-0" />
                  <h2 className="font-bold text-lg truncate">{city}</h2>
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-[var(--muted)]">
                  <span className="tabular-nums font-medium text-[var(--foreground)]">
                    {sortedEvents.length}
                  </span>
                  <span>etkinlik</span>
                  {freeCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-[var(--success)] font-medium">
                        <Ticket className="size-3" />
                        {freeCount} ücretsiz
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Paneli kapat"
                className="grid place-items-center size-9 rounded-full hover:bg-[var(--muted-bg)] transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* Liste */}
            <ul className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2">
              {sortedEvents.length === 0 && (
                <li className="text-center text-sm text-[var(--muted)] py-12">
                  Bu şehir için uygun filtrede etkinlik bulunamadı.
                </li>
              )}
              {sortedEvents.map((e) => {
                const { day, month } = formatShortDate(e.startsAt);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/etkinlik/${e.slug}`}
                      className="group flex items-stretch gap-3 rounded-2xl border border-[var(--border)] p-3 hover:border-[var(--primary)]/60 hover:bg-[var(--muted-bg)]/40 transition-colors"
                      onClick={onClose}
                    >
                      {/* Tarih bloğu */}
                      <div className="grid place-items-center w-14 shrink-0 rounded-xl bg-[var(--muted-bg)] py-1.5">
                        <span className="text-lg font-bold leading-none tabular-nums">{day}</span>
                        <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)] mt-0.5">
                          {month}
                        </span>
                      </div>

                      {/* İçerik */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h3 className="text-sm font-semibold line-clamp-2 leading-snug flex-1 group-hover:text-[var(--primary)] transition-colors">
                            {e.title}
                          </h3>
                          {e.isFree ? (
                            <Badge variant="free" className="shrink-0">Ücretsiz</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                          <Badge variant="category" className="text-[10px] py-0">
                            {tCat(e.category)}
                          </Badge>
                          <Calendar className="size-3 ms-1" />
                          <span className="truncate">{formatEventDate(e.startsAt)}</span>
                        </div>
                        {e.venue && (
                          <div className="mt-0.5 text-[11px] text-[var(--muted)] truncate">
                            {e.venue}
                          </div>
                        )}
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                          Detaya git
                          <ArrowRight className="size-3" />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Footer CTA */}
            {sortedEvents.length > 0 && (
              <footer className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
                <button
                  type="button"
                  onClick={() => onSeeAll(city)}
                  className="w-full rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all glow-primary"
                >
                  {cityLocativeKi(city)} tüm etkinlikleri
                  <ArrowRight className="size-4" />
                </button>
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
