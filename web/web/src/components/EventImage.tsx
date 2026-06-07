"use client";

import Image from "next/image";
import { useState } from "react";
import { CalendarDays, Music2, Gift, Theater, Trophy, Image as ImageIcon, Mic2, Sparkles, Baby } from "lucide-react";
import type { EventCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Kategori bazlı varsayılan görseller (doğrulanmış 200 OK Unsplash URL'leri) */
const CATEGORY_FALLBACK_IMG: Record<EventCategory, string> = {
  KONSER:   "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80",
  FESTIVAL: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&q=80",
  TIYATRO:  "https://images.unsplash.com/photo-1503095396549-807759245b35?w=1200&q=80",
  STANDUP:  "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=1200&q=80",
  SPOR:     "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&q=80",
  SERGI:    "https://images.unsplash.com/photo-1577720580479-7d839d829c73?w=1200&q=80",
  ATOLYE:   "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",
  COCUK:    "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=1200&q=80",
  DIGER:    "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&q=80",
};

interface EventImageProps {
  src?: string | null;
  alt: string;
  category?: EventCategory;
  isFree?: boolean;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
  width?: number;
  height?: number;
}

const CATEGORY_ICON: Record<EventCategory, typeof CalendarDays> = {
  KONSER:   Music2,
  FESTIVAL: Sparkles,
  TIYATRO:  Theater,
  STANDUP:  Mic2,
  SPOR:     Trophy,
  SERGI:    ImageIcon,
  ATOLYE:   Gift,
  COCUK:    Baby,
  DIGER:    CalendarDays,
};

const CATEGORY_GRADIENT: Record<EventCategory, string> = {
  KONSER:   "from-violet-500/30 via-fuchsia-500/20 to-rose-500/30",
  FESTIVAL: "from-amber-500/30 via-orange-500/20 to-rose-500/30",
  TIYATRO:  "from-rose-500/30 via-pink-500/20 to-purple-500/30",
  STANDUP:  "from-yellow-500/30 via-amber-500/20 to-orange-500/30",
  SPOR:     "from-emerald-500/30 via-teal-500/20 to-cyan-500/30",
  SERGI:    "from-cyan-500/30 via-blue-500/20 to-indigo-500/30",
  ATOLYE:   "from-emerald-500/30 via-lime-500/20 to-yellow-500/30",
  COCUK:    "from-pink-500/30 via-rose-500/20 to-red-500/30",
  DIGER:    "from-zinc-500/30 via-slate-500/20 to-neutral-500/30",
};

export function EventImage({
  src, alt, category = "DIGER", isFree, fill, priority, sizes, className, width, height,
}: EventImageProps) {
  const [errored, setErrored] = useState(false);
  const [fallbackErrored, setFallbackErrored] = useState(false);
  const showFallback = !src || errored;

  if (showFallback && !fallbackErrored) {
    const fallbackSrc = CATEGORY_FALLBACK_IMG[category] ?? CATEGORY_FALLBACK_IMG.DIGER;
    return (
      <div className="relative w-full h-full" data-fallback="event-img">
        <Image
          src={fallbackSrc}
          alt={alt}
          fill={fill}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          onError={() => setFallbackErrored(true)}
          className={className}
        />
        {isFree && (
          <span className="absolute top-3 start-3 rounded-full bg-[var(--success)]/90 text-white px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold backdrop-blur">
            Ücretsiz
          </span>
        )}
      </div>
    );
  }

  if (showFallback && fallbackErrored) {
    const Icon = CATEGORY_ICON[category] ?? CalendarDays;
    const gradient = CATEGORY_GRADIENT[category] ?? CATEGORY_GRADIENT.DIGER;
    return (
      <div
        className={cn("relative w-full h-full bg-gradient-to-br grid place-items-center", gradient, className)}
        data-fallback="event-gradient"
      >
        <Icon className="size-12 sm:size-16 text-[var(--foreground)]/60" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <Image
      src={src!}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
