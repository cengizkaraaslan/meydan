"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Heart, Sparkles, MapPin } from "lucide-react";
import { MOCK_USERS } from "@/lib/social-data";
import { BUDDY_POOL } from "@/lib/buddy-seed";
import { Avatar } from "@/components/ui/Avatar";
import { RandomBuddyButton } from "@/components/RandomBuddyButton";

interface BuddyPreview {
  username: string;
  name: string;
  color: string;
  avatarUrl: string;
  interest: string;
  chip: string;
}

function buddyFromPool(username: string, fallback: { name: string; color: string }) {
  const b = BUDDY_POOL.find((b) => b.username === username);
  return {
    name: b?.name ?? fallback.name,
    color: b?.color ?? fallback.color,
    avatarUrl: b?.avatarUrl ?? "",
  };
}

/** Hero üstünde sergilenen 3 buddy önizleme kartı — buddy-seed pool'undan seçili. */
const HERO_BUDDIES: BuddyPreview[] = [
  {
    username: "selin",
    ...buddyFromPool("selin", { name: "Selin K.", color: "#ec4899" }),
    interest: "Ortak ilgi: Festival + Müzik",
    chip: "Bu hafta sonu / festival",
  },
  {
    username: "burak",
    ...buddyFromPool("burak", { name: "Burak D.", color: "#10b981" }),
    interest: "Ortak ilgi: Stand-Up + Jazz",
    chip: "Cuma akşamı / sahne",
  },
  {
    username: "zeynep",
    ...buddyFromPool("zeynep", { name: "Zeynep T.", color: "#ef4444" }),
    interest: "Ortak ilgi: Sergi + Sanat",
    chip: "Bu hafta sonu / sinemaya",
  },
];

export function Hero({ totalEvents }: { totalEvents: number; totalSources: number; totalCities: number }) {
  const stack = MOCK_USERS.slice(0, 6);

  return (
    <section className="relative overflow-hidden isolate">
      {/* Arka plan videosu — kafede/etkinlikte buluşan insanlar.
          Çok düşük opacity + blur → ön plandaki yazılar net okunur. */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&h=1080&fit=crop&auto=format&q=70"
          className="absolute inset-0 w-full h-full object-cover opacity-25 dark:opacity-20 blur-md scale-110"
          aria-hidden="true"
        >
          {/* Pexels License: serbest, ticari kullanım dahil */}
          <source
            src="https://videos.pexels.com/video-files/8132859/8132859-uhd_2560_1440_25fps.mp4"
            type="video/mp4"
          />
        </video>
        {/* Karartma + tema rengine yumuşak geçiş */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--background)]/70 via-[var(--background)]/55 to-[var(--background)]/85" />
        <div className="absolute inset-0 bg-[var(--background)]/30" />
      </div>

      {/* Mevcut animasyonlu gradient blob'lar — videonun üstüne yumuşak vurgu katar */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -start-10 size-[380px] rounded-full bg-[var(--primary)]/30 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -16, 0], y: [0, 16, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-10 end-0 size-[320px] rounded-full bg-[var(--accent)]/30 blur-3xl"
        />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-12 pb-14 sm:pt-20 sm:pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--muted)]"
        >
          <Heart className="size-3.5 text-[var(--primary)]" />
          Etkinliğe yalnız gitmek yok
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]"
        >
          Sana eşleşen biri var
          <br />
          <span className="gradient-text">Birlikte gidelim</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="mt-5 mx-auto max-w-md text-base sm:text-lg text-[var(--muted)]"
        >
          Konser, festival, sinema — beğendiğin etkinlikte buddy bul.
        </motion.p>

        <BuddyCardStack buddies={HERO_BUDDIES} />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.32 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/hafta-sonu"
            className="group inline-flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3.5 text-sm sm:text-base font-semibold hover:opacity-95 transition-all hover:scale-[1.02] glow-primary"
          >
            <Sparkles className="size-4" />
            Bu hafta seninle çıkacak 3 kişi
            <ArrowRight className="size-4 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
          </Link>
          <Link
            href="/yakinimda"
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-3.5 text-sm sm:text-base font-semibold hover:bg-[var(--muted-bg)] transition-colors"
          >
            <MapPin className="size-4" />
            Bana göre etkinlik
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.36 }}
          className="mt-5 flex flex-col items-center gap-2"
        >
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <span className="h-px w-10 bg-[var(--border)]" />
            veya
            <span className="h-px w-10 bg-[var(--border)]" />
          </div>
          <RandomBuddyButton variant="compact" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <div className="flex -space-x-2.5">
            {stack.map((u) => (
              <Avatar
                key={u.username}
                src={u.avatarUrl}
                name={u.name}
                color={u.color}
                size="size-8"
                className="ring-2 ring-[var(--background)]"
              />
            ))}
          </div>
          <span className="text-sm text-[var(--muted)]">
            <strong className="text-[var(--foreground)]">1.284</strong> kişi şu an etkinlik arkadaşı arıyor
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6 text-xs text-[var(--muted)]"
        >
          Türkiye'de {totalEvents.toLocaleString("tr-TR")} etkinlik · keşfe hazır
        </motion.div>
      </div>
    </section>
  );
}

/** 3 buddy kartlı animasyonlu yığın — Tinder-card vibe. 4sn'de bir üst kart kayıp
 * altına gider, sıradaki gelir. Hover/tap'le pause edilir. */
function BuddyCardStack({ buddies }: { buddies: BuddyPreview[] }) {
  const [order, setOrder] = useState<BuddyPreview[]>(buddies);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setOrder((prev) => {
        // Üstteki kart (sondaki) dibe atılır
        const next = [...prev];
        const top = next.pop();
        if (top) next.unshift(top);
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.18 }}
      className="mt-8 sm:mt-10 flex justify-center"
    >
      <div
        className="group relative h-[240px] sm:h-[240px] w-full max-w-[340px] px-2"
        aria-label="Eşleşme önizlemesi"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {order.map((b, i) => (
            <BuddyCard
              key={b.username}
              buddy={b}
              index={i}
              total={order.length}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function BuddyCard({
  buddy,
  index,
  total,
}: {
  buddy: BuddyPreview;
  index: number;
  total: number;
}) {
  // Yığın efekti: arka kartlar hafif sağa kayık + scale küçük + opacity düşük.
  // Üstteki kart (index === total-1) tam görünür ve hover'da hafif yukarı.
  const depth = total - 1 - index; // 0 = en üstte, total-1 = en dipte
  const baseRotate = (depth - 1) * -4; // -4°, 0°, 4° gibi
  const baseY = depth * 10;
  const baseScale = 1 - depth * 0.05;
  const baseOpacity = 1 - depth * 0.18;
  const isTop = depth === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: baseY + 40, rotate: baseRotate - 6, scale: baseScale - 0.04 }}
      animate={{ opacity: baseOpacity, y: baseY, rotate: baseRotate, scale: baseScale }}
      exit={{ opacity: 0, x: 60, y: baseY - 20, rotate: 14, scale: baseScale, transition: { duration: 0.35 } }}
      whileHover={isTop ? { y: baseY - 8, scale: baseScale + 0.02, rotate: 0 } : undefined}
      whileTap={isTop ? { scale: baseScale + 0.01 } : undefined}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{ zIndex: 10 + index }}
      className="absolute inset-x-0 mx-auto top-0 w-[260px] sm:w-[320px] rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-xl shadow-black/10 dark:shadow-black/40 text-start"
    >
      <div className="flex items-center gap-3">
        {buddy.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={buddy.avatarUrl}
            alt={buddy.name}
            loading="lazy"
            decoding="async"
            className="size-12 sm:size-14 rounded-2xl object-cover shadow-md shrink-0"
          />
        ) : (
          <span
            className="grid size-12 sm:size-14 place-items-center rounded-2xl text-white text-base sm:text-lg font-bold shadow-md shrink-0"
            style={{ background: `linear-gradient(135deg, ${buddy.color}, ${buddy.color}cc)` }}
          >
            {buddy.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm sm:text-base truncate">{buddy.name}</div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 text-[11px] font-medium ring-1 ring-[var(--primary)]/20">
            <Sparkles className="size-3" />
            <span className="truncate max-w-[16ch] sm:max-w-[18ch]">{buddy.interest}</span>
          </div>
        </div>
        <Heart className="size-5 text-[var(--primary)] shrink-0" fill="currentColor" />
      </div>

      <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--muted-bg)] px-3 py-1 text-[11px] font-medium text-[var(--muted)]">
        <span className="size-1.5 rounded-full bg-[var(--success)]" />
        {buddy.chip}
      </div>
    </motion.div>
  );
}
