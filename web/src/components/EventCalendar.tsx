"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { isUniversitySource, type EventListItem } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

interface EventCalendarProps {
  events: EventListItem[];
  initialYear: number;
  initialMonth: number; // 0-11
  cityFilter?: string;
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function EventCalendar({ events, initialYear, initialMonth, cityFilter }: EventCalendarProps) {
  const tCat = useTranslations("categories");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Sayfa yalnızca seçili ayın ±1 ayını (3 ay) sunucudan çeker. Kullanıcı bu
  // pencerenin dışına gidince state'i URL'e yansıtıp sunucudan yeni veri çekeriz;
  // aksi halde takvim yanlışlıkla "boş" görünürdü.
  useEffect(() => {
    if (year === initialYear && month === initialMonth) return;
    const next = new URLSearchParams(searchParams);
    next.set("year", String(year));
    next.set("month", String(month));
    startTransition(() => router.push(`/takvim?${next.toString()}`, { scroll: false }));
    // searchParams'ı bağımlılığa koymuyoruz: sadece year/month değişiminde tetiklensin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, initialYear, initialMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventListItem[]>();
    for (const e of events) {
      const d = e.startsAt;
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      const arr = map.get(day) ?? [];
      arr.push(e);
      map.set(day, arr);
    }
    return map;
  }, [events, year, month]);

  const firstDay = startOfMonth(year, month);
  const dim = daysInMonth(year, month);
  // Pazartesi haftanın ilk günü → getDay() Pazar=0; ofsete dönüştür
  const offset = (firstDay.getDay() + 6) % 7;
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const totalCells = Math.ceil((offset + dim) / 7) * 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length < totalCells) cells.push(null);

  function nav(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  }

  const totalThisMonth = useMemo(() => {
    let count = 0;
    eventsByDay.forEach((arr) => (count += arr.length));
    return count;
  }, [eventsByDay]);

  const selectedEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => nav(-1)}
            aria-label="Önceki ay"
            className="grid place-items-center size-9 rounded-full border border-[var(--border)] hover:bg-[var(--muted-bg)] transition-colors"
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(null); }}
            className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] hover:bg-[var(--muted-bg)]"
          >
            Bugün
          </button>
          <button
            type="button"
            onClick={() => nav(1)}
            aria-label="Sonraki ay"
            className="grid place-items-center size-9 rounded-full border border-[var(--border)] hover:bg-[var(--muted-bg)] transition-colors"
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
        </div>
        <div className="flex-1 min-w-[200px] text-center">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {TR_MONTHS[month]} {year}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5 inline-flex items-center gap-2">
            <CalendarDays className="size-3" />
            {totalThisMonth} etkinlik {cityFilter && `• ${cityFilter}`}
          </p>
        </div>
        <div className="w-[112px]" /> {/* placeholder for symmetry */}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--muted)] uppercase">
        {TR_DAYS_SHORT.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, idx) => {
          if (day == null) {
            return <div key={idx} className="aspect-square sm:aspect-[4/5] rounded-xl bg-[var(--muted-bg)]/30" />;
          }
          const dayEvents = eventsByDay.get(day) ?? [];
          const isToday = isCurrentMonth && today.getDate() === day;
          const isSelected = selectedDay === day;
          const hasEvents = dayEvents.length > 0;

          return (
            <motion.button
              type="button"
              key={idx}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              whileTap={{ scale: 0.96 }}
              className={`relative aspect-square sm:aspect-[4/5] rounded-xl border p-1.5 sm:p-2 text-start transition-all overflow-hidden flex flex-col gap-1 ${
                isSelected
                  ? "border-[var(--primary)] bg-[var(--primary)]/8 ring-2 ring-[var(--primary)]/30"
                  : isToday
                    ? "border-[var(--accent)] bg-[var(--accent)]/8"
                    : hasEvents
                      ? "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50"
                      : "border-[var(--border)]/50 bg-[var(--muted-bg)]/20 hover:bg-[var(--muted-bg)]/40"
              }`}
            >
              <div className={`text-xs sm:text-sm font-bold ${isToday ? "text-[var(--accent)]" : ""}`}>
                {day}
              </div>
              {hasEvents && (
                <div className="hidden sm:flex flex-col gap-0.5 min-h-0 flex-1">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                        e.isFree ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-[var(--primary)]/12 text-[var(--primary)]"
                      }`}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-[var(--muted)] px-1">+{dayEvents.length - 2}</div>
                  )}
                </div>
              )}
              {hasEvents && (
                <div className="sm:hidden absolute bottom-1 start-1 end-1 flex justify-center gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`size-1.5 rounded-full ${e.isFree ? "bg-[var(--success)]" : "bg-[var(--primary)]"}`}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedDay && selectedEvents.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
              <header className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold">
                  {selectedDay} {TR_MONTHS[month]} {year}
                </h3>
                <span className="text-xs text-[var(--muted)]">{selectedEvents.length} etkinlik</span>
              </header>
              <ul className="space-y-2">
                {selectedEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/etkinlik/${e.slug}`}
                      className="block rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 hover:bg-[var(--muted-bg)]/30 p-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid place-items-center size-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
                          <CalendarDays className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{e.title}</div>
                          <div className="text-xs text-[var(--muted)] inline-flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3" /> {e.venue} • {e.city}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-[var(--muted)]">
                            {e.startsAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div className={`text-xs font-medium mt-0.5 ${e.isFree ? "text-[var(--success)]" : ""}`}>
                            {isUniversitySource(e.source)
                              ? "🎓 Öğrenciye açık"
                              : formatPrice(e.priceMin, e.priceMax, e.isFree)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 text-[10px]">
                          {tCat(e.category)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
