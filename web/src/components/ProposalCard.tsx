"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Users, CalendarDays } from "lucide-react";
import { Badge } from "./ui/Badge";
import { CATEGORY_LABELS } from "@/lib/types";
import { formatEventDate } from "@/lib/utils";
import { PROPOSAL_STATUS_LABELS, type ProposalItem } from "@/lib/proposal-data";
import { cn } from "@/lib/utils";

export function ProposalCard({ proposal, index = 0 }: { proposal: ProposalItem; index?: number }) {
  const pct = Math.min(100, Math.round((proposal.attendeeCount / proposal.threshold) * 100));
  const filled = pct >= 100;

  // Progress bar rengi yüzdeye göre değişir:
  // 0-39 → muted, 40-79 → primary, 80-99 → accent, 100 → success
  const barColor = filled
    ? "var(--success)"
    : pct >= 80
      ? "var(--accent)"
      : pct >= 40
        ? "var(--primary)"
        : "var(--muted)";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--card)] transition-shadow hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5",
        proposal.pinned
          ? "border-[var(--primary)]/40 ring-1 ring-[var(--primary)]/20"
          : "border-[var(--border)]",
      )}
    >
      {proposal.imageUrl && (
        <Link href={`/onerilen/${proposal.slug}`} className="relative aspect-[16/9] overflow-hidden block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proposal.imageUrl}
            alt={proposal.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {proposal.pinned && (
            <span className="absolute top-3 start-3 inline-flex items-center gap-1 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold shadow-lg">
              📌 Sabitlendi
            </span>
          )}
        </Link>
      )}
      <div className="p-5 flex flex-col flex-1">
      <Link href={`/onerilen/${proposal.slug}`} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {!proposal.imageUrl && proposal.pinned && (
            <Badge variant="default">📌 Admin</Badge>
          )}
          {proposal.isDiscussion ? (
            <Badge variant="default">💬 Tartışma</Badge>
          ) : (
            <Badge variant="category">{CATEGORY_LABELS[proposal.category]}</Badge>
          )}
          {proposal.status === "PROMOTED" && !proposal.isDiscussion && (
            <Badge variant="free">✨ {PROPOSAL_STATUS_LABELS.PROMOTED}</Badge>
          )}
          {proposal.status === "REJECTED" && (
            <Badge variant="warning">{PROPOSAL_STATUS_LABELS.REJECTED}</Badge>
          )}
        </div>

        <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
          {proposal.title}
        </h3>

        <p className="text-sm text-[var(--muted)] line-clamp-3">{proposal.description}</p>

        <div className="space-y-1.5 text-sm text-[var(--muted)]">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">{formatEventDate(proposal.suggestedDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {proposal.suggestedVenue} • {proposal.suggestedCity}
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-4 space-y-2">
        {proposal.isDiscussion ? (
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-[var(--muted)]">
              <Users className="size-3.5" />
              <strong className="text-[var(--foreground)]">{proposal.attendeeCount}</strong>
              <span>kişi yorum yazdı</span>
            </span>
            <span className="text-[var(--primary)] font-medium">Tavsiyeni yaz →</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <Users className="size-3.5" />
                <span>
                  <strong className="text-[var(--foreground)]">{proposal.attendeeCount}</strong>
                  <span> / {proposal.threshold} katılımcı</span>
                </span>
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  filled ? "text-[var(--success)]" : "text-[var(--foreground)]",
                )}
              >
                %{pct}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted-bg)]">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: barColor }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: Math.min(index * 0.04, 0.3) + 0.15, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>@{proposal.creatorUsername}</span>
              {!filled && proposal.status === "PENDING" && (
                <span>{proposal.threshold - proposal.attendeeCount} kişi daha</span>
              )}
            </div>
          </>
        )}
      </div>
      </div>
    </motion.article>
  );
}
