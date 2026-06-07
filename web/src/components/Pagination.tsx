"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MotionLink = motion.create(Link);

interface PaginationProps {
  /** Mevcut sayfa (1 tabanlı) */
  page: number;
  /** Toplam sayfa sayısı */
  totalPages: number;
  /** /etkinlikler için aktif arama parametreleri (page hariç korunur) */
  params: Record<string, string | undefined>;
  /** Hedef yol (varsayılan /etkinlikler) */
  basePath?: string;
}

/** Görünecek sayfa numaralarını üret: 1 … (p-1) p (p+1) … son */
function pageWindow(page: number, totalPages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const want = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  let prev = 0;
  for (let n = 1; n <= totalPages; n++) {
    if (!want.has(n)) continue;
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};
const item = {
  hidden: { opacity: 0, y: 8, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 420, damping: 30 } },
};

/** Animasyonlu sayfalama — page dışındaki tüm filtreleri koruyarak ?page=N linki üretir. */
export function Pagination({ page, totalPages, params, basePath = "/etkinlikler" }: PaginationProps) {
  if (totalPages <= 1) return null;

  function hrefFor(target: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page") continue;
      if (v) sp.set(k, v);
    }
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const items = pageWindow(page, totalPages);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const cellBase =
    "relative inline-grid place-items-center h-10 rounded-xl text-sm font-semibold select-none";
  const arrowBase = cn(cellBase, "w-10");
  const numBase = cn(cellBase, "min-w-10 px-3.5");

  return (
    <motion.nav
      aria-label="Sayfalama"
      variants={container}
      initial="hidden"
      animate="show"
      className="mt-10 flex items-center justify-center gap-1.5 flex-wrap"
    >
      {/* Önceki */}
      {prevDisabled ? (
        <motion.span variants={item} className={cn(arrowBase, "border border-[var(--border)] text-[var(--muted)] opacity-40 cursor-not-allowed")} aria-disabled>
          <ChevronLeft className="size-4" />
        </motion.span>
      ) : (
        <MotionLink
          href={hrefFor(page - 1)}
          scroll
          aria-label="Önceki sayfa"
          variants={item}
          whileHover={{ scale: 1.12, y: -2 }}
          whileTap={{ scale: 0.9 }}
          className={cn(arrowBase, "border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors")}
        >
          <ChevronLeft className="size-4" />
        </MotionLink>
      )}

      {/* Sayfa numaraları */}
      {items.map((it, i) =>
        it === "…" ? (
          <motion.span key={`gap-${i}`} variants={item} className="px-1.5 text-[var(--muted)] select-none">
            …
          </motion.span>
        ) : it === page ? (
          <motion.span key={it} variants={item} aria-current="page" className={cn(numBase, "text-[var(--primary-foreground)]")}>
            {/* Kayan aktif pill — sayfa değişince yumuşakça yeni numaraya kayar */}
            <motion.span
              layoutId="active-page-pill"
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 shadow-lg shadow-[var(--primary)]/35"
            />
            <span className="relative z-10">{it}</span>
          </motion.span>
        ) : (
          <MotionLink
            key={it}
            href={hrefFor(it)}
            scroll
            variants={item}
            whileHover={{ scale: 1.12, y: -2 }}
            whileTap={{ scale: 0.9 }}
            className={cn(numBase, "border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors")}
          >
            {it}
          </MotionLink>
        ),
      )}

      {/* Sonraki */}
      {nextDisabled ? (
        <motion.span variants={item} className={cn(arrowBase, "border border-[var(--border)] text-[var(--muted)] opacity-40 cursor-not-allowed")} aria-disabled>
          <ChevronRight className="size-4" />
        </motion.span>
      ) : (
        <MotionLink
          href={hrefFor(page + 1)}
          scroll
          aria-label="Sonraki sayfa"
          variants={item}
          whileHover={{ scale: 1.12, y: -2 }}
          whileTap={{ scale: 0.9 }}
          className={cn(arrowBase, "border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors")}
        >
          <ChevronRight className="size-4" />
        </MotionLink>
      )}
    </motion.nav>
  );
}
