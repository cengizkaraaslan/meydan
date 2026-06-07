"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquare, UserPlus, Sparkles, Film } from "lucide-react";
import { toast } from "sonner";
import { MOCK_USERS, type PublicUser } from "@/lib/social-data";
import { Avatar } from "@/components/ui/Avatar";

interface MovieBuddyMatchmakerProps {
  /** Used to seed deterministic ordering — typically `movie:<slug>:<city>` */
  seedKey: string;
  city: string;
  /** Sinema türleri — örn. ["Aksiyon", "Macera"] */
  genres: string[];
  limit?: number;
}

interface ScoredBuddy {
  user: PublicUser;
  score: number;
  sharedInterest: string;
}

/** FNV-1a 32-bit — deterministic, no collisions for short inputs. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function deriveSharedInterest(user: PublicUser, genres: string[]): string {
  const bio = user.bio.toLocaleLowerCase("tr");
  const pool: string[] = ["Sinema"];
  for (const g of genres) {
    const gl = g.toLocaleLowerCase("tr");
    if (
      (gl.includes("aksiyon") && bio.includes("spor")) ||
      (gl.includes("dram") && bio.includes("tiyatro")) ||
      (gl.includes("müzik") && bio.includes("müzik")) ||
      (gl.includes("müzikal") && bio.includes("konser")) ||
      (gl.includes("animasyon") && bio.includes("çocuk")) ||
      (gl.includes("komedi") && bio.includes("stand-up")) ||
      (gl.includes("biyografi") && bio.includes("sanat"))
    ) {
      pool.push(g);
    }
  }
  if (bio.includes("film") || bio.includes("sinema")) pool.push("Sinema fanı");
  const unique = Array.from(new Set(pool)).slice(0, 2);
  return `Ortak ilgi: ${unique.join(" + ")}`;
}

function scoreBuddies(seedKey: string, genres: string[]): ScoredBuddy[] {
  const genresLower = genres.map((g) => g.toLocaleLowerCase("tr"));
  return MOCK_USERS
    .map<ScoredBuddy>((user) => {
      const base = fnv1a(`${seedKey}::${user.username}`) % 1000;
      const bio = user.bio.toLocaleLowerCase("tr");
      let bonus = 0;
      if (bio.includes("film") || bio.includes("sinema")) bonus += 250;
      for (const g of genresLower) {
        if (g.includes("aksiyon") && bio.includes("spor")) bonus += 150;
        if (g.includes("dram") && bio.includes("tiyatro")) bonus += 150;
        if ((g.includes("müzik") || g.includes("müzikal")) && (bio.includes("konser") || bio.includes("müzik"))) bonus += 150;
        if (g.includes("animasyon") && bio.includes("çocuk")) bonus += 200;
        if (g.includes("komedi") && bio.includes("stand-up")) bonus += 200;
        if (g.includes("sanat") && bio.includes("sergi")) bonus += 100;
      }
      return {
        user,
        score: base + bonus,
        sharedInterest: deriveSharedInterest(user, genres),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function MovieBuddyMatchmaker({
  seedKey,
  city,
  genres,
  limit = 5,
}: MovieBuddyMatchmakerProps) {
  const ranked = useMemo(() => scoreBuddies(seedKey, genres), [seedKey, genres]);
  const buddies = ranked.slice(0, limit);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shrink-0">
            <Film className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight truncate">
              <span aria-hidden>🎬</span> Bu filme birlikte gidelim
            </h2>
            <p className="text-xs text-[var(--muted)] truncate">
              {city} • {genres.slice(0, 2).join(" + ") || "Sinema"} ilgisiyle eşleştirildi
            </p>
          </div>
        </div>
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
