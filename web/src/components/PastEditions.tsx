"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { History, MessageSquare, ChevronRight } from "lucide-react";
import { formatEventDate } from "@/lib/utils";
import type { EventListItem } from "@/lib/types";

/** "Önceki yıllardan" — aynı serinin geçmiş edisyonları, yorum/katılım özetiyle. */
export function PastEditions({ events }: { events: EventListItem[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <History className="size-4 text-[var(--primary)]" /> Önceki yıllardan
      </h2>
      <p className="text-sm text-[var(--muted)] mb-3">
        Bu etkinliğin geçmiş edisyonları — yorumlara ve katılıma göz at.
      </p>
      <div className="space-y-2">
        {events.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <Link
              href={`/etkinlik/${e.slug}`}
              className="group flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 hover:border-[var(--primary)]/50 hover:bg-[var(--muted-bg)]/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{e.title}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{formatEventDate(e.startsAt)}</div>
              </div>
              {(e.commentCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)] shrink-0">
                  <MessageSquare className="size-3.5" /> {e.commentCount}
                </span>
              )}
              <ChevronRight className="size-4 text-[var(--muted)] shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
