"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { CITIES, CATEGORY_LABELS, SOURCE_LABELS, type EventCategory, type EventSource } from "@/lib/types";
import { TURKEY_DISTRICTS } from "@/lib/turkey-districts";
import { VoiceSearch } from "./VoiceSearch";
import { Select } from "./ui/Select";
import { NearestCityButton } from "./NearestCityButton";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategory[];
const SOURCES = Object.keys(SOURCE_LABELS) as EventSource[];

/** Şehir tercihini cookie'ye yaz (1 yıl) — anasayfa, /hafta-sonu vb. okur */
function persistCityCookie(city: string) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `meydanfest_city=${encodeURIComponent(city)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // ignore
  }
}

export function FilterPanel() {
  const t = useTranslations("filters");
  const tCat = useTranslations("categories");
  const tDate = useTranslations("filters.date_options");
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("page"); // filtre değişti → 1. sayfaya dön (boş sayfada kalma)
    startTransition(() => router.push(`/etkinlikler?${next.toString()}`, { scroll: false }));
  }

  const currentCity = params.get("city") ?? "";
  const currentDistrict = params.get("district") ?? "";
  const currentCategory = params.get("category") ?? "";
  const currentSource = params.get("source") ?? "";
  const currentDate = params.get("date") ?? "";
  const freeOnly = params.get("free") === "1";
  const search = params.get("q") ?? "";
  const hasFilters = currentCity || currentDistrict || currentCategory || currentSource || currentDate || freeOnly || search;
  const activeCount =
    (currentCity ? 1 : 0) +
    (currentDistrict ? 1 : 0) +
    (currentCategory ? 1 : 0) +
    (currentSource ? 1 : 0) +
    (currentDate ? 1 : 0) +
    (freeOnly ? 1 : 0) +
    (search ? 1 : 0);

  const DATE_PRESETS = ["today", "tomorrow", "weekend", "week", "month"] as const;

  // İlçe listesi STATİK client verisinden (turkiyeapi'den üretilmiş 81 il / 973 ilçe).
  // Fetch YOK → ağ/ad-blocker/Neon cold-start/cache hiçbirine bağımlı değil; şehir
  // seçilir seçilmez dropdown KESİN dolu gelir. (Eski /api/districts fetch'i bazı
  // ortamlarda boş dönüp dropdown'u "sadece Tüm X ilçeleri" bırakıyordu.)
  const districts = currentCity ? TURKEY_DISTRICTS[currentCity] ?? [] : [];

  // Drawer açıkken arka plan scroll'unu kilitle
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  const panelContent = (
    <motion.div layout className="space-y-5">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {t("title")}
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push("/etkinlikler", { scroll: false }))}
            className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1"
          >
            <X className="size-3" />
            Temizle
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted)]" />
        <input
          // key={search}: URL'deki "q" dışarıdan değişince (örn. "Temizle" ya da
          // sesli arama) defaultValue'lu input remount olup yeni değere sıfırlansın.
          key={search}
          ref={searchInputRef}
          type="search"
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value);
          }}
          placeholder={t("search")}
          className="w-full rounded-xl border border-[var(--border)] bg-transparent ps-10 pe-11 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
        />
        <div className="absolute end-2 top-1/2 -translate-y-1/2">
          <VoiceSearch
            onResult={(text) => {
              if (searchInputRef.current) {
                searchInputRef.current.value = text;
              }
              update("q", text);
            }}
          />
        </div>
      </div>

      <motion.label
        layout
        whileTap={{ scale: 0.98 }}
        className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:bg-[var(--muted-bg)]/50 transition-colors"
      >
        <span className="text-sm font-medium">🎁 {t("free_only")}</span>
        <input
          type="checkbox"
          checked={freeOnly}
          onChange={(e) => update("free", e.target.checked ? "1" : null)}
          className="size-4 accent-[var(--primary)]"
        />
      </motion.label>

      <motion.div layout className="space-y-2">
        <NearestCityButton
          onResolve={(city) => {
            persistCityCookie(city);
            const next = new URLSearchParams(params);
            next.set("city", city);
            next.delete("district");
            next.delete("page");
            startTransition(() => router.push(`/etkinlikler?${next.toString()}`, { scroll: false }));
          }}
        />
        <Select
          label={t("city")}
          value={currentCity}
          onChange={(v) => {
            // Manuel seçim de hatırlansın → anasayfa bu şehri kullanır
            if (v) persistCityCookie(v);
            const next = new URLSearchParams(params);
            if (v) next.set("city", v);
            else next.delete("city");
            next.delete("district");
            next.delete("page");
            startTransition(() => router.push(`/etkinlikler?${next.toString()}`, { scroll: false }));
          }}
          options={[{ value: "", label: t("all_cities") }, ...CITIES.map((c) => ({ value: c, label: c }))]}
          disabled={pending}
        />
        <AnimatePresence initial={false}>
          {currentCity && (
            <motion.div
              key="district-select"
              // NOT: overflow:hidden + height animasyonu YOK — aksi halde Select'in
              // absolute konumlu açılır listesi kapsayıcı tarafından KIRPILIYORDU
              // (dropdown DOM'da vardı ama görünmüyordu → "ilçe boş" sanılıyordu).
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Select
                label={t("district")}
                value={currentDistrict}
                onChange={(v) => update("district", v)}
                options={[
                  { value: "", label: `Tüm ${currentCity} ilçeleri` },
                  ...districts.map((d) => ({ value: d, label: d })),
                ]}
                disabled={pending}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <Select
        label={t("date")}
        value={currentDate}
        onChange={(v) => update("date", v)}
        options={[
          { value: "", label: tDate("all") },
          ...DATE_PRESETS.map((d) => ({ value: d, label: tDate(d) })),
        ]}
        disabled={pending}
      />
      <Select
        label={t("category")}
        value={currentCategory}
        onChange={(v) => update("category", v)}
        options={[{ value: "", label: t("all_categories") }, ...CATEGORIES.map((c) => ({ value: c, label: tCat(c) }))]}
        disabled={pending}
      />
      <Select
        label={t("source")}
        value={currentSource}
        onChange={(v) => update("source", v)}
        options={[{ value: "", label: t("all_sources") }, ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))]}
        disabled={pending}
      />
    </motion.div>
  );

  return (
    <>
      {/* Masaüstü (lg+) inline panel */}
      <aside className="hidden lg:block">{panelContent}</aside>

      {/* Mobil / tablet (lg altı) sticky FAB + drawer */}
      <motion.button
        type="button"
        onClick={() => setMobileOpen(true)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        className="lg:hidden fixed bottom-24 end-4 z-30 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-3 text-sm font-semibold shadow-xl shadow-[var(--primary)]/30"
        aria-label="Filtreyi aç"
      >
        <SlidersHorizontal className="size-4" />
        Filtrele
        {activeCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-grid size-5 place-items-center rounded-full bg-white/25 text-[11px] font-bold"
          >
            {activeCount}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              key="filter-drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[var(--background)] border-t border-[var(--border)] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--muted-bg)]" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Filtrele</h2>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Kapat"
                  className="grid place-items-center size-9 rounded-full border border-[var(--border)] hover:bg-[var(--muted-bg)]"
                >
                  <X className="size-4" />
                </button>
              </div>
              {panelContent}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="mt-5 w-full rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] py-3 text-sm font-semibold"
              >
                Sonuçları göster
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
