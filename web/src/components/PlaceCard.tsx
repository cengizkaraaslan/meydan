"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Clock } from "lucide-react";
import { Badge } from "./ui/Badge";
import { LikeButton } from "./LikeButton";
import { EventImage } from "./EventImage";
import { PLACE_TYPE_LABELS, type PlaceListItem } from "@/lib/types";

/** PlaceCard — EventCard'ın kalıcı-yer karşılığı: tarih/fiyat/RSVP YOK; tür + açık saat var. */
const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      delay: Math.min(i * 0.04, 0.3),
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export function PlaceCard({ place, index = 0 }: { place: PlaceListItem; index?: number }) {
  const hours =
    place.openTime && place.closeTime
      ? `${place.openTime}–${place.closeTime}`
      : place.openTime ?? null;

  return (
    <motion.article
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="show"
      whileHover={{ y: -3, scale: 1.02, transition: { type: "spring", stiffness: 320, damping: 22 } }}
      whileTap={{ scale: 0.97 }}
      custom={index}
      data-index={index}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-xl hover:shadow-[var(--primary)]/15 dark:hover:shadow-[var(--primary)]/25"
    >
      <Link href={`/yer/${place.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          <EventImage
            src={place.imageUrl}
            alt={place.name}
            category="SERGI"
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-110"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
            <Badge variant="category">{PLACE_TYPE_LABELS[place.type] ?? "Gezilecek Yer"}</Badge>
            {place.featured && <Badge variant="warning">✨ Öne çıkan</Badge>}
          </div>
          {hours && (
            <div className="absolute end-3 top-3">
              <Badge variant="default" className="bg-[var(--background)]/95 backdrop-blur inline-flex items-center gap-1">
                <Clock className="size-3" />
                {hours}
              </Badge>
            </div>
          )}
          <div className="absolute end-3 bottom-3 z-10">
            <LikeButton eventId={place.id} initialCount={0} />
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
            {place.name}
          </h3>
          <div className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {place.district ? `${place.district} • ${place.city}` : place.city}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
