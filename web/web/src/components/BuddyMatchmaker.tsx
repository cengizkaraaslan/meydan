"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquare, UserPlus, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { MOCK_USERS, type PublicUser } from "@/lib/social-data";
import type { EventCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

interface BuddyMatchmakerProps {
  eventId: string;
  city: string;
  category: EventCategory;
  /** Kaç buddy önerisi gösterilsin (default: 5). Tümünü gör sayfası 12 verir. */
  limit?: number;
  /** "Tümünü gör" linkini gizle (full liste sayfasında gereksiz). */
  hideViewAllLink?: boolean;
  /** Hedef event slug — "Tümünü gör" linkinin gideceği yer. */
  eventSlug?: string;
}

/**
 * Skor: hash(eventId + username) → deterministic 0..999 + ilgi alanı bonusu.
 * Aynı (eventId, MOCK_USERS) çifti her zaman aynı sırayı verir.
 */
interface ScoredBuddy {
  user: PublicUser;
  score: number;
  sharedInterest: string;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}

/** Bio + kategori eşleştirmesinden "Ortak ilgi" türet (tamamen mock). */
function deriveSharedInterest(user: PublicUser, category: EventCategory): string {
  const bio = user.bio.toLocaleLowerCase("tr");
  const catLabel = CATEGORY_LABELS[category];
  const pool: string[] = [catLabel];
  if (bio.includes("konser") || bio.includes("müzik") || bio.includes("rock") || bio.includes("jazz")) pool.push("Konser");
  if (bio.includes("festival")) pool.push("Festival");
  if (bio.includes("tiyatro")) pool.push("Tiyatro");
  if (bio.includes("spor") || bio.includes("galatasaray") || bio.includes("dövüş")) pool.push("Spor");
  if (bio.includes("sergi") || bio.includes("sanat")) pool.push("Sergi");
  if (bio.includes("stand-up")) pool.push("Stand-Up");
  if (bio.includes("atölye") || bio.includes("çocuk")) pool.push("Atölye");
  // Tekrarsız, ilk iki tanesi
  const unique = Array.from(new Set(pool)).slice(0, 2);
  return `Ortak ilgi: ${unique.join(" + ")}`;
}

function scoreBuddies(eventId: string, category: EventCategory): ScoredBuddy[] {
  return MOCK_USERS
    .map<ScoredBuddy>((user) => {
      const base = hashCode(`${eventId}::${user.username}`) % 1000;
      // Kategoriye uyan bio'lar için ekstra puan (deterministic)
      const bio = user.bio.toLocaleLowerCase("tr");
      const catKey = category.toLocaleLowerCase("tr");
      const bonus =
        bio.includes(catKey) ||
        (category === "KONSER"   && (bio.includes("konser") || bio.includes("müzik") || bio.includes("jazz"))) ||
        (category === "FESTIVAL" && bio.includes("festival")) ||
        (category === "TIYATRO"  && bio.includes("tiyatro")) ||
        (category === "STANDUP"  && bio.includes("stand-up")) ||
        (category === "SPOR"     && (bio.includes("spor") || bio.includes("galatasaray") || bio.includes("dövüş"))) ||
        (category === "SERGI"    && (bio.includes("sergi") || bio.includes("sanat"))) ||
        (category === "COCUK"    && bio.includes("çocuk")) ||
        (category === "ATOLYE"   && (bio.includes("atölye") || bio.includes("workshop")))
          ? 350
          : 0;
      return {
        user,
        score: base + bonus,
        sharedInterest: deriveSharedInterest(user, category),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function BuddyMatchmaker({
  eventId,
  city,
  category,
  limit = 5,
  hideViewAllLink = false,
  eventSlug,
}: BuddyMatchmakerProps) {
  const ranked = useMemo(() => scoreBuddies(eventId, category), [eventId, category]);
  const buddies = ranked.slice(0, limit);
  const totalCount = ranked.length;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shrink-0">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight truncate">
              <span aria-hidden>🤝</span> Birlikte gidebileceğin {totalCount} kişi
            </h2>
            <p className="text-xs text-[var(--muted)] truncate">
              {city} • {CATEGORY_LABELS[category]} ilgi alanıyla eşleştirildi
            </p>
          </div>
        </div>
        {!hideViewAllLink && eventSlug && (
          <Link
            href={`/etkinlik/${eventSlug}/buddies`}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
          >
            Tümünü gör
            <ArrowRight className="size-3.5 rtl:rotate-180" />
          </Link>
        )}
      </header>

      <motion.ul
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        {buddies.map((b) => (
          <BuddyCard key={b.user.username} buddy={b} />
        ))}
      </motion.ul>
    </section>
  );
}

function BuddyCard({ buddy }: { buddy: ScoredBuddy }) {
  const { user, sharedInterest } = buddy;

  function onMessage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toast.success(`${user.name.split(" ")[0]} ile mesaj başlatıldı`);
  }

  function onFollow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toast.success(`${user.name.split(" ")[0]} takip ediliyor`);
  }

  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 p-3 transition-shadow hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5"
    >
      <Link href={`/profil/${user.username}`} className="flex items-center gap-3 min-w-0">
        <Avatar
          src={user.avatarUrl}
          name={user.name}
          color={user.color}
          size="size-12"
          className="shadow-md"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate group-hover:text-[var(--primary)] transition-colors">
            {user.name}
          </div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 text-[10px] font-medium ring-1 ring-[var(--primary)]/20">
            <Sparkles className="size-3" />
            <span className="truncate max-w-[14ch] sm:max-w-[18ch]">{sharedInterest}</span>
          </div>
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onMessage}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--muted-bg)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--border)] transition-colors"
        >
          <MessageSquare className="size-3.5" />
          Mesaj At
        </button>
        <button
          type="button"
          onClick={onFollow}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] px-2.5 py-1.5 text-xs font-medium hover:opacity-95 transition-opacity"
        >
          <UserPlus className="size-3.5" />
          Takip Et
        </button>
      </div>
    </motion.li>
  );
}

