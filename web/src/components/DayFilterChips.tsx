"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * Etkinlik listesi üstündeki güne göre hızlı filtre çipleri (Tümü / Bugün /
 * Yarın / Hafta sonu). FilterPanel'deki "date" Select'iyle AYNI `date`
 * searchParam'ını kullanır → seçim server-side from/to aralığına (page.tsx
 * resolveDateRange) dönüşür. CityFilterChips ile aynı çip tasarımı.
 */
const DAY_PRESETS = ["today", "tomorrow", "weekend"] as const;

export function DayFilterChips() {
  const tDate = useTranslations("filters.date_options");
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = params.get("date") ?? "";

  function select(value: string) {
    const next = new URLSearchParams(params);
    if (!value) next.delete("date");
    else next.set("date", value);
    next.delete("page"); // filtre değişti → 1. sayfa
    startTransition(() => router.push(`/etkinlikler?${next.toString()}`, { scroll: false }));
  }

  return (
    <nav aria-label={tDate("all")} className="-mx-2 px-2">
      <motion.ul layout className="flex flex-wrap gap-2">
        <Chip active={current === ""} label={tDate("all")} onClick={() => select("")} disabled={pending} />
        {DAY_PRESETS.map((d) => (
          <Chip
            key={d}
            active={current === d}
            label={tDate(d)}
            onClick={() => select(d)}
            disabled={pending}
          />
        ))}
      </motion.ul>
    </nav>
  );
}

function Chip({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.li layout="position">
      <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={active}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors disabled:opacity-60 " +
            (active
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
              : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--muted-bg)]")
          }
        >
          <AnimatePresence initial={false}>
            {active && (
              <motion.span
                key="check"
                initial={{ width: 0, opacity: 0, scale: 0.6 }}
                animate={{ width: "auto", opacity: 1, scale: 1 }}
                exit={{ width: 0, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex overflow-hidden"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
          {label}
        </button>
      </motion.div>
    </motion.li>
  );
}
