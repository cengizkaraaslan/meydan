"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, ChevronDown, Lock } from "lucide-react";
import {
  computeBadges,
  TIER_COLORS,
  TIER_LABELS,
  type BadgeWithProgress,
  type UserStats,
} from "@/lib/badges";

interface BadgeGridProps {
  stats: UserStats;
  /** Başka kullanıcının profilinde kilitli rozetleri gizle */
  hideLocked?: boolean;
}

export function BadgeGrid({ stats, hideLocked = false }: BadgeGridProps) {
  const { earned, locked, level, xp, nextLevelXp } = computeBadges(stats);
  const [showAll, setShowAll] = useState(false);

  const visibleLocked = hideLocked ? [] : locked.slice(0, showAll ? locked.length : 4);
  const xpProgress = Math.round(((500 - nextLevelXp) / 500) * 100);

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Award className="size-5 text-[var(--primary)]" />
          <h2 className="text-xl font-semibold">Rozetler</h2>
          <span className="text-xs text-[var(--muted)]">
            {earned.length}/{earned.length + locked.length}
          </span>
        </div>

        {/* Seviye + XP bar */}
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white text-sm font-bold shadow-md">
            {level}
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">Seviye {level}</div>
            <div className="w-32 h-1.5 rounded-full bg-[var(--muted-bg)] overflow-hidden mt-0.5">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] transition-all"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">
              {xp} XP · {nextLevelXp} XP kaldı
            </div>
          </div>
        </div>
      </div>

      {/* Kazanılmış rozetler */}
      {earned.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {earned.map((b) => (
            <BadgeCard key={b.id} badge={b} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-sm text-[var(--muted)]">
            Henüz rozetin yok — etkinliklere katılarak kazanmaya başla
          </div>
        </div>
      )}

      {/* Kilitli rozetler */}
      {visibleLocked.length > 0 && (
        <>
          <div className="mt-6 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted)] font-semibold">
            <Lock className="size-3" />
            Yakında kazanılacaklar
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {visibleLocked.map((b) => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
          {!showAll && locked.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
            >
              {locked.length - 4} rozet daha göster
              <ChevronDown className="size-4" />
            </button>
          )}
        </>
      )}
    </section>
  );
}

function BadgeCard({ badge }: { badge: BadgeWithProgress }) {
  const colors = TIER_COLORS[badge.tier];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`group relative flex flex-col items-center text-center rounded-2xl border border-[var(--border)] p-3 transition-all ${
        badge.earned ? `bg-gradient-to-br ${colors.bg} ring-1 ${colors.ring}` : "bg-[var(--card)] opacity-70"
      }`}
    >
      <div className={`text-3xl mb-1 ${badge.earned ? "" : "grayscale opacity-50"}`}>
        {badge.emoji}
      </div>
      <div className="text-xs font-semibold truncate w-full">{badge.title}</div>
      <div className={`text-[10px] mt-0.5 uppercase tracking-wider font-semibold ${colors.text}`}>
        {TIER_LABELS[badge.tier]}
      </div>
      {!badge.earned && (
        <div className="w-full mt-2">
          <div className="h-1 rounded-full bg-[var(--muted-bg)] overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all"
              style={{ width: `${badge.progress}%` }}
            />
          </div>
          <div className="text-[10px] text-[var(--muted)] mt-0.5">
            {badge.progress}%
          </div>
        </div>
      )}
      {/* Hover tooltip */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          whileHover={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 w-44 rounded-xl bg-[var(--foreground)] text-[var(--background)] text-[11px] px-3 py-2 shadow-xl"
        >
          {badge.description}
          {!badge.earned && (
            <div className="mt-1 opacity-70">{badge.remaining} kaldı</div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
