"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ExternalLink, MapPin, X, AlertTriangle, Clock, CalendarDays } from "lucide-react";

interface ProviderLite {
  key: string;
  name: string;
  city: string;
  registerUrl: string;
}
interface CourseLite {
  name: string;
  slug: string;
  center?: string;
  start?: string;
  end?: string;
  schedule?: string;
  image?: string;
  full?: boolean;
  open?: boolean;
}
export interface CourseGroupLite {
  provider: ProviderLite;
  courses: CourseLite[];
}

function fold(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ş/g, "s").replace(/Ş/g, "s").replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u").replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase().trim();
}

function AccordionItem({ group, query, defaultOpen }: { group: CourseGroupLite; query: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { provider, courses } = group;
  const has = courses.length > 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-start hover:bg-[var(--muted-bg)]/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            {provider.name}
            {!has && !query && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[11px] font-medium shrink-0">
                <AlertTriangle className="size-3" /> kayıt kapalı
              </span>
            )}
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <MapPin className="size-3.5" /> {provider.city} ·{" "}
            {has ? (
              <span className="text-[var(--primary)] font-medium">{courses.length} branş</span>
            ) : (
              <span>{query ? "eşleşme yok" : "liste şu an alınamıyor"}</span>
            )}
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-[var(--muted)]">
          <ChevronDown className="size-5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="b"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4 pt-1 space-y-3">
              {has ? (
                courses.some((c) => c.center || c.schedule || c.image) ? (
                  // Zengin kart: görsel (KOMEK/GASMEK) + doluluk/merkez/saat/tarih (ESMEK)
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {courses.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/kurslar/${c.slug}`}
                        className="group block overflow-hidden rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                      >
                        {c.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.image}
                            alt={c.name}
                            loading="lazy"
                            className="w-full aspect-[16/9] object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm leading-snug">{c.name}</span>
                            {c.full ? (
                              <span className="shrink-0 rounded-full bg-[var(--danger)]/15 text-[var(--danger)] px-2 py-0.5 text-[11px] font-semibold">Dolu</span>
                            ) : c.open ? (
                              <span className="shrink-0 rounded-full bg-[var(--success)]/15 text-[var(--success)] px-2 py-0.5 text-[11px] font-semibold">Kayıt Alıyor</span>
                            ) : null}
                          </div>
                          {c.center && (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-[var(--muted)]">
                              <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{c.center}</span>
                            </div>
                          )}
                          {c.schedule && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)]">
                              <Clock className="size-3.5 shrink-0" /> <span className="truncate">{c.schedule}</span>
                            </div>
                          )}
                          {(c.start || c.end) && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)]">
                              <CalendarDays className="size-3.5 shrink-0" /> {c.start} – {c.end}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  // Görsel/detay olmayan (İZMEK): chip
                  <div className="flex flex-wrap gap-2">
                    {courses.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/kurslar/${c.slug}`}
                        className="rounded-lg border border-[var(--border)] bg-[var(--muted-bg)]/40 px-2.5 py-1 text-sm hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )
              ) : query ? (
                <p className="text-sm text-[var(--muted)]">Bu aramayla eşleşen branş yok.</p>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2.5 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <span className="text-[var(--muted)]">
                    Branş listesi şu an otomatik alınamıyor (kayıt dönemi kapalı olabilir ya da kurum
                    listesini JavaScript ile yüklüyor). Güncel branşlar ve kayıt için kurumun ön kayıt
                    sayfasına git.
                  </span>
                </div>
              )}
              <a
                href={provider.registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-semibold hover:opacity-95"
              >
                Ön kayıt sayfası <ExternalLink className="size-3.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CoursesExplorer({ groups, defaultCity = "" }: { groups: CourseGroupLite[]; defaultCity?: string }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(defaultCity);

  const cities = useMemo(
    () => Array.from(new Set(groups.map((g) => g.provider.city))).sort((a, b) => a.localeCompare(b, "tr")),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = fold(query);
    return groups
      .filter((g) => !city || g.provider.city === city)
      .map((g) => ({
        provider: g.provider,
        courses: q ? g.courses.filter((c) => fold(c.name).includes(q)) : g.courses,
      }));
  }, [groups, query, city]);

  const totalMatches = filtered.reduce((s, g) => s + g.courses.length, 0);

  return (
    <div className="space-y-5">
      {/* Arama + şehir filtreleri — etkinlik aramasıyla aynı dil */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Branş ara (ör. bilişim, ahşap, müzik, dil)…"
            className="w-full rounded-xl border border-[var(--border)] bg-transparent ps-10 pe-10 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Temizle"
              className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCity("")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              !city ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] hover:border-[var(--primary)]"
            }`}
          >
            Tüm şehirler
          </button>
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCity(city === c ? "" : c)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                city === c ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] hover:border-[var(--primary)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="text-sm text-[var(--muted)]">
          {totalMatches} branş{query && ` · "${query}"`}{city && ` · ${city}`}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((g) => (
          <AccordionItem key={g.provider.key} group={g} query={query} defaultOpen={g.courses.length > 0 && (!!query || g.courses.length <= 60)} />
        ))}
      </div>
    </div>
  );
}
