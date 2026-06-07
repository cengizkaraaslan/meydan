"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Sparkles, Filter, X as XIcon, CalendarDays, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EventCategory, EventListItem } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { TURKEY_CITY_COORDS, TURKEY_OUTLINE_PATH, getCityCoord, type CityCoord } from "@/lib/turkey-coords";
import { CityEventsPanel } from "./CityEventsPanel";

interface CityBucket {
  coord: CityCoord;
  events: EventListItem[];
  freeCount: number;
  paidCount: number;
}

interface TurkeyMapProps {
  events: EventListItem[];
  initialCategory?: string;
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategory[];

type DateFilter = "all" | "week" | "month";

/**
 * Cluster yarıçapı (SVG units). Spec: 8 + min(count, 30) * 0.8, [8..32] clamp.
 */
function clusterRadius(count: number): number {
  return Math.max(8, Math.min(32, 8 + Math.min(count, 30) * 0.8));
}

/**
 * Cluster büyüklüğüne göre renk — küçükler primary (mor), büyükler accent'e doğru (turuncu).
 * Lineer interpolasyon yerine color-mix() kullanırız (CSS değerleri).
 */
function clusterFill(count: number): string {
  // 1 → 100% primary, 30+ → 100% accent
  const t = Math.min(1, Math.max(0, (count - 1) / 29));
  // color-mix: t kadar accent'e karış
  const pct = Math.round(t * 100);
  return `color-mix(in oklch, var(--primary) ${100 - pct}%, var(--accent) ${pct}%)`;
}

/**
 * Aynı şehrin badge text rengi — küçük pin'lerde okunabilir, büyüklerde de kontrast korur.
 */
function clusterTextColor(): string {
  return "var(--primary-foreground)";
}

/** ISO-week start (Pazartesi) — yerel saat dilimi. */
function weekStart(d: Date): Date {
  const day = d.getDay(); // Pazar=0, Pazartesi=1...
  const diff = (day + 6) % 7; // Pazartesi'ye kaç gün geri
  const r = new Date(d);
  r.setDate(r.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function weekEnd(d: Date): Date {
  const s = weekStart(d);
  const r = new Date(s);
  r.setDate(r.getDate() + 7);
  return r;
}

function monthStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(1);
  r.setHours(0, 0, 0, 0);
  return r;
}

function monthEnd(d: Date): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + 1, 1);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function TurkeyMap({ events, initialCategory }: TurkeyMapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const tCat = useTranslations("categories");

  const [hovered, setHovered] = useState<string | null>(null);
  const [openCity, setOpenCity] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(initialCategory ?? "");
  const [freeOnly, setFreeOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const filteredEvents = useMemo(() => {
    let out = events;
    if (category) out = out.filter((e) => e.category === category);
    if (freeOnly) out = out.filter((e) => e.isFree);
    if (dateFilter !== "all") {
      const now = new Date();
      const from = dateFilter === "week" ? weekStart(now) : monthStart(now);
      const to = dateFilter === "week" ? weekEnd(now) : monthEnd(now);
      out = out.filter((e) => {
        const t = new Date(e.startsAt).getTime();
        return t >= from.getTime() && t < to.getTime();
      });
    }
    return out;
  }, [events, category, freeOnly, dateFilter]);

  /** İl bazında etkinlik kovaları — sadece koordinatı bilinen illeri tut. */
  const buckets = useMemo(() => {
    const map = new Map<string, CityBucket>();
    for (const e of filteredEvents) {
      const coord = getCityCoord(e.city);
      if (!coord) continue;
      const existing = map.get(coord.name);
      if (existing) {
        existing.events.push(e);
        if (e.isFree) existing.freeCount++;
        else existing.paidCount++;
      } else {
        map.set(coord.name, {
          coord,
          events: [e],
          freeCount: e.isFree ? 1 : 0,
          paidCount: e.isFree ? 0 : 1,
        });
      }
    }
    return map;
  }, [filteredEvents]);

  /** Pin overlap için: büyük cluster en üstte render edilsin diye event count'a göre artan sırada çiz. */
  const sortedBuckets = useMemo(
    () => Array.from(buckets.entries()).sort((a, b) => a[1].events.length - b[1].events.length),
    [buckets],
  );

  function handleCategoryToggle(v: EventCategory | "") {
    const next = v === category ? "" : v;
    setCategory(next);
    const params = new URLSearchParams(searchParams);
    if (next) params.set("category", next);
    else params.delete("category");
    startTransition(() =>
      router.push(`/harita${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false }),
    );
  }

  function goToCityFilter(cityName: string) {
    const next = new URLSearchParams();
    next.set("city", cityName);
    if (category) next.set("category", category);
    if (freeOnly) next.set("free", "1");
    router.push(`/etkinlikler?${next.toString()}`);
  }

  const totalShown = filteredEvents.length;
  const citiesWithEvents = buckets.size;
  const openBucketEvents = openCity ? (buckets.get(openCity)?.events ?? []) : [];

  return (
    <div className="space-y-5">
      {/* Filter chips */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4 space-y-3">
        {/* Kategori chips */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            <Tag className="size-3" />
            Kategori
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ChipButton
              active={category === ""}
              onClick={() => handleCategoryToggle("")}
              label="Tümü"
            />
            {CATEGORIES.map((c) => (
              <ChipButton
                key={c}
                active={category === c}
                onClick={() => handleCategoryToggle(c)}
                label={tCat(c)}
              />
            ))}
          </div>
        </div>

        {/* Date + free row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-[var(--muted)]" />
            <div className="flex gap-1">
              <ChipButton active={dateFilter === "all"} onClick={() => setDateFilter("all")} label="Her zaman" size="sm" />
              <ChipButton active={dateFilter === "week"} onClick={() => setDateFilter("week")} label="Bu hafta" size="sm" />
              <ChipButton active={dateFilter === "month"} onClick={() => setDateFilter("month")} label="Bu ay" size="sm" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFreeOnly((v) => !v)}
            aria-pressed={freeOnly}
            className={[
              "ms-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              freeOnly
                ? "bg-[var(--success)]/15 text-[var(--success)] ring-1 ring-[var(--success)]/40"
                : "bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block size-2 rounded-full",
                freeOnly ? "bg-[var(--success)]" : "bg-[var(--muted)]",
              ].join(" ")}
            />
            Sadece ücretsiz
          </button>

          {(category || freeOnly || dateFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setCategory("");
                setFreeOnly(false);
                setDateFilter("all");
                const params = new URLSearchParams(searchParams);
                params.delete("category");
                startTransition(() =>
                  router.push(`/harita${params.toString() ? `?${params.toString()}` : ""}`, {
                    scroll: false,
                  }),
                );
              }}
              className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <XIcon className="size-3" />
              Filtreleri sıfırla
            </button>
          )}
        </div>

        {/* Özet satırı */}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          <Filter className="size-3.5" />
          <span>
            <span className="font-bold text-[var(--foreground)] tabular-nums">
              {totalShown.toLocaleString("tr-TR")}
            </span>{" "}
            etkinlik
          </span>
          <span className="text-[var(--border)]">|</span>
          <span>
            <span className="font-bold text-[var(--foreground)] tabular-nums">
              {citiesWithEvents}
            </span>{" "}
            şehir
          </span>
        </div>
      </div>

      {/* Harita */}
      <div className="relative">
        <div className="relative rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--muted-bg)]/40 overflow-hidden">
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-auto block"
            role="img"
            aria-label="Türkiye etkinlik haritası"
          >
            {/* Arka plan grid'i */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity="0.04" strokeWidth="1" />
              </pattern>
              <radialGradient id="clusterPulse" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="clusterPulseSmall" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="1000" height="500" fill="url(#grid)" />

            {/* Türkiye sınırı */}
            <motion.path
              d={TURKEY_OUTLINE_PATH}
              fill="var(--muted-bg)"
              fillOpacity="0.5"
              stroke="var(--border)"
              strokeWidth="1.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />

            {/* Boş şehir dotları */}
            {Object.values(TURKEY_CITY_COORDS)
              .filter((c) => !buckets.has(c.name))
              .map((c) => (
                <circle
                  key={`empty-${c.name}`}
                  cx={c.x}
                  cy={c.y}
                  r="2"
                  fill="var(--muted)"
                  fillOpacity="0.22"
                />
              ))}

            {/* Cluster pin'leri — küçükten büyüğe çizilir ki büyük olan üstte kalsın */}
            {sortedBuckets.map(([cityName, bucket], i) => {
              const count = bucket.events.length;
              const r = clusterRadius(count);
              const fill = clusterFill(count);
              const isHovered = hovered === cityName;
              const showBadge = count > 1;
              // Pulse: küçük cluster'larda primary, büyüklerde accent renkli halo
              const pulseUrl = count >= 8 ? "url(#clusterPulse)" : "url(#clusterPulseSmall)";

              return (
                <g
                  key={cityName}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(cityName)}
                  onMouseLeave={() => setHovered((c) => (c === cityName ? null : c))}
                  onClick={() => setOpenCity(cityName)}
                  role="button"
                  aria-label={`${cityName} — ${count} etkinlik`}
                >
                  {/* Pulse halo */}
                  <motion.circle
                    cx={bucket.coord.x}
                    cy={bucket.coord.y}
                    r={r}
                    fill={pulseUrl}
                    animate={{ scale: [1, 2.1, 1], opacity: [0.55, 0, 0.55] }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: (i % 8) * 0.18,
                    }}
                    pointerEvents="none"
                  />
                  {/* Pin (büyük cluster'da glow halkası) */}
                  {count >= 10 && (
                    <circle
                      cx={bucket.coord.x}
                      cy={bucket.coord.y}
                      r={r + 4}
                      fill="none"
                      stroke={fill}
                      strokeWidth="1.5"
                      strokeOpacity="0.4"
                      pointerEvents="none"
                    />
                  )}
                  <motion.circle
                    cx={bucket.coord.x}
                    cy={bucket.coord.y}
                    r={r}
                    fill={fill}
                    stroke="var(--background)"
                    strokeWidth={isHovered ? 3 : 2}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: isHovered ? 1.15 : 1, opacity: 1 }}
                    transition={{
                      scale: { type: "spring", stiffness: 300, damping: 18 },
                      opacity: { duration: 0.4, delay: 0.5 + Math.min(i * 0.02, 0.6) },
                    }}
                  />
                  {/* Cluster sayısı (count > 1 ise her zaman göster) */}
                  {showBadge && (
                    <text
                      x={bucket.coord.x}
                      y={bucket.coord.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={r >= 16 ? 13 : r >= 12 ? 11 : 9}
                      fontWeight="800"
                      fill={clusterTextColor()}
                      pointerEvents="none"
                      style={{ userSelect: "none" }}
                    >
                      {count}
                    </text>
                  )}
                  {/* Şehir etiketi (büyükçe pin'lerde) */}
                  {r >= 12 && (
                    <text
                      x={bucket.coord.x}
                      y={bucket.coord.y + r + 12}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="var(--foreground)"
                      pointerEvents="none"
                      style={{ userSelect: "none" }}
                    >
                      {cityName}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Boş durum mesajı (filtrede sonuç yoksa) */}
            {buckets.size === 0 && (
              <g>
                <rect
                  x="350"
                  y="220"
                  width="300"
                  height="60"
                  rx="14"
                  fill="var(--card)"
                  stroke="var(--border)"
                />
                <text
                  x="500"
                  y="248"
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill="var(--foreground)"
                >
                  Bu filtrede etkinlik bulunamadı
                </text>
                <text
                  x="500"
                  y="266"
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--muted)"
                >
                  Kategoriyi veya tarih aralığını değiştirin
                </text>
              </g>
            )}
          </svg>

          {/* Desktop hover tooltip */}
          <AnimatePresence>
            {hovered && buckets.get(hovered) && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="hidden md:block absolute top-4 end-4 max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md shadow-2xl p-4 pointer-events-none z-10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="size-4 text-[var(--primary)]" />
                  <h3 className="font-bold text-sm">{hovered}</h3>
                  <span className="ms-auto text-xs text-[var(--muted)]">
                    {buckets.get(hovered)!.events.length} etkinlik
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {buckets
                    .get(hovered)!
                    .events.slice(0, 3)
                    .map((e) => (
                      <li key={e.id} className="flex items-start gap-2 text-xs">
                        <span
                          className={`inline-block size-1.5 rounded-full mt-1.5 shrink-0 ${
                            e.isFree ? "bg-[var(--success)]" : "bg-[var(--primary)]"
                          }`}
                        />
                        <span className="line-clamp-2 leading-snug">{e.title}</span>
                      </li>
                    ))}
                  {buckets.get(hovered)!.events.length > 3 && (
                    <li className="text-[10px] text-[var(--muted)] ps-3.5">
                      +{buckets.get(hovered)!.events.length - 3} daha…
                    </li>
                  )}
                </ul>
                <div className="mt-2 pt-2 border-t border-[var(--border)] text-[10px] text-[var(--muted)] inline-flex items-center gap-1">
                  <Sparkles className="size-3" />
                  Tıkla → tümünü gör
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Etkinlik paneli */}
      <CityEventsPanel
        city={openCity}
        events={openBucketEvents}
        onClose={() => setOpenCity(null)}
        onSeeAll={(c) => {
          setOpenCity(null);
          goToCityFilter(c);
        }}
      />
    </div>
  );
}

/* ---------------- Chip button ---------------- */

interface ChipButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}

function ChipButton({ label, active, onClick, size = "md" }: ChipButtonProps) {
  const sz = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-full font-semibold whitespace-nowrap transition-all",
        sz,
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] glow-primary"
          : "bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--muted-bg),white_5%)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
