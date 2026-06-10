"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Users, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "./ui/Badge";
import { LikeButton } from "./LikeButton";
import { EventImage } from "./EventImage";
import { formatEventDate, formatPrice, formatShortDate } from "@/lib/utils";
import { isUniversitySource, type EventListItem } from "@/lib/types";
import { seedLikeCount, seedLikersFor } from "@/lib/social-data";

/** Hem standalone hem de StaggerGrid parent altında çalışır: parent staggerChildren
 * varsa o yönetir, yoksa custom={index}'e göre kendi gecikmesini verir. */
const EVENT_CARD_VARIANTS = {
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

export function EventCard({ event, index = 0 }: { event: EventListItem; index?: number }) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const tEvent = useTranslations("event");
  const { day, month } = formatShortDate(event.startsAt);

  return (
    <motion.article
      variants={EVENT_CARD_VARIANTS}
      initial="hidden"
      animate="show"
      whileHover={{ y: -3, scale: 1.02, transition: { type: "spring", stiffness: 320, damping: 22 } }}
      whileTap={{ scale: 0.97 }}
      custom={index}
      data-index={index}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-xl hover:shadow-[var(--primary)]/15 dark:hover:shadow-[var(--primary)]/25"
    >
      <Link href={`/etkinlik/${event.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          <EventImage
            src={event.imageUrl}
            alt={event.title}
            category={event.category}
            isFree={event.isFree}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-110"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute start-3 top-3 rounded-xl bg-[var(--background)]/95 backdrop-blur px-2.5 py-1.5 text-center shadow-sm">
            <div className="text-lg font-bold leading-none">{day}</div>
            <div className="text-[10px] font-medium tracking-wider text-[var(--muted)]">{month}</div>
          </div>
          <div className="absolute end-3 top-3 flex flex-col items-end gap-1.5">
            {isUniversitySource(event.source) ? (
              // Üniversite etkinliği: ücretsiz/ücretli net değil, çoğu zaman sadece üniv
              // öğrencilerine açık → yanıltıcı "Ücretsiz" yerine üniversite belirteci göster.
              <Badge
                variant="default"
                className="bg-indigo-600/90 text-white backdrop-blur border-transparent"
                title="Üniversite etkinliği — genellikle üniversite öğrencilerine açık, bilet gerekmez"
              >
                🎓 Öğrenciye açık
              </Badge>
            ) : event.isFree ? (
              <Badge variant="free">{tCommon("free")}</Badge>
            ) : (
              <Badge variant="default" className="bg-[var(--background)]/95 backdrop-blur">
                {formatPrice(event.priceMin, event.priceMax, event.isFree, event.category)}
              </Badge>
            )}
            {event.featured && <Badge variant="warning">✨ Öne çıkan</Badge>}
          </div>
          <div className="absolute end-3 bottom-3 z-10">
            <LikeButton eventId={event.id} initialCount={seedLikeCount(event.id)} />
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="category">{t(event.category)}</Badge>
            <span className="text-xs text-[var(--muted)]">{formatEventDate(event.startsAt)}</span>
          </div>
          <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.venue} • {event.city}</span>
          </div>
          {(event.attendeeCount != null || event.commentCount != null) && (
            <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-[var(--border)] mt-1">
              {(() => {
                const buddies = seedLikersFor(event.id).slice(0, 3);
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    {buddies.length > 0 && (
                      <div className="flex -space-x-2 shrink-0">
                        {buddies.map((u) => (
                          <span
                            key={u.username}
                            title={u.name}
                            className="grid size-6 place-items-center rounded-full text-white text-[10px] font-semibold ring-2 ring-[var(--card)]"
                            style={{ background: u.color }}
                          >
                            {u.name.charAt(0)}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-[var(--muted)] inline-flex items-center gap-1 truncate">
                      {event.attendeeCount != null && (
                        <>
                          <Users className="size-3 shrink-0" />
                          <span className="truncate">
                            <strong className="text-[var(--foreground)]">
                              {event.attendeeCount.toLocaleString("tr-TR")}
                            </strong>{" "}
                            gidiyor
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })()}
              {event.commentCount != null && event.commentCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)] shrink-0">
                  <MessageSquare className="size-3" />
                  {event.commentCount}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.article>
  );
}
