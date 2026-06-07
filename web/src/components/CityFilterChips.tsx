"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

export function CityFilterChips({
  cities,
  selectedCity,
}: {
  cities: string[];
  selectedCity: string | null;
}) {
  return (
    <nav aria-label="Şehir filtresi" className="-mx-2 px-2">
      <motion.ul layout className="flex flex-wrap gap-2">
        <Chip href="/sinema" active={selectedCity === null} label="Tümü" />
        {cities.map((c) => (
          <Chip
            key={c}
            href={`/sinema?sehir=${encodeURIComponent(c)}`}
            active={selectedCity === c}
            label={c}
          />
        ))}
      </motion.ul>
    </nav>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <motion.li layout="position">
      <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }}>
        <Link
          href={href}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors " +
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
        </Link>
      </motion.div>
    </motion.li>
  );
}
