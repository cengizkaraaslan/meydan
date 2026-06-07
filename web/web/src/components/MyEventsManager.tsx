"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Eye,
  Trash2,
  Pencil,
  Calendar,
  MapPin,
  Users,
  PartyPopper,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import {
  listMyEventsAction,
  deleteMyEventAction,
  type MyEventRow,
} from "@/lib/event-create-actions";
import { CATEGORY_LABELS } from "@/lib/types";
import { formatEventDate, cn } from "@/lib/utils";

/** Deterministik fake stat — slug hash'inden üretir, refresh'te sabit kalır. */
function fakeStats(id: string): { views: number; rsvps: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  const views = 80 + (h % 920); // 80–999
  const rsvps = 3 + ((h >>> 8) % 60); // 3–62
  return { views, rsvps };
}

export function MyEventsManager() {
  const [events, setEvents] = useState<MyEventRow[] | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listMyEventsAction()
      .then((rows) => {
        if (alive) setEvents(rows);
      })
      .catch(() => {
        if (alive) setEvents([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  function handleDelete(ev: MyEventRow) {
    const ok = window.confirm(`"${ev.title}" silinsin mi? Bu geri alınamaz.`);
    if (!ok) return;
    // İyimser güncelleme: önce listeden çıkar.
    setEvents((prev) => prev?.filter((e) => e.slug !== ev.slug) ?? prev);
    startTransition(async () => {
      const res = await deleteMyEventAction(ev.slug);
      if (!res.ok) {
        toast.error("Silinemedi", { description: res.error ?? "Tekrar dene." });
        // Geri al — listeyi yeniden çek.
        const rows = await listMyEventsAction().catch(() => null);
        if (rows) setEvents(rows);
        return;
      }
      toast.success("Etkinlik silindi", { description: ev.title });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-[var(--muted)]">
          {events == null
            ? "Yükleniyor…"
            : `${events.length} etkinlik yayında`}
        </div>

        <Link
          href="/yayinla"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
        >
          <Plus className="size-4" />
          Yeni etkinlik
        </Link>
      </div>

      {events == null ? (
        <ListSkeleton />
      ) : events.length === 0 ? (
        <EmptyAll />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {events.map((event, i) => (
              <motion.li
                key={event.slug}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(i * 0.04, 0.3),
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <EventRow event={event} onDelete={() => handleDelete(event)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function EventRow({
  event,
  onDelete,
}: {
  event: MyEventRow;
  onDelete: () => void;
}) {
  const stats = fakeStats(event.slug);
  return (
    <article className="group flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition-shadow hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5">
      <div className="relative aspect-square size-20 sm:size-24 shrink-0 overflow-hidden rounded-xl bg-[var(--muted-bg)]">
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt={event.title}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-[var(--muted)]">
            <Calendar className="size-7" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2">
            {event.title}
          </h3>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              event.hidden
                ? "bg-[var(--muted-bg)] text-[var(--muted)] ring-1 ring-[var(--border)]"
                : "bg-[var(--success)]/15 text-[var(--success)] ring-1 ring-[var(--success)]/30",
            )}
          >
            {event.hidden ? (
              <>
                <EyeOff className="size-3" />
                Gizli
              </>
            ) : (
              "Yayında"
            )}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
          <Badge variant="category" className="text-[10px] py-0">
            {CATEGORY_LABELS[event.category]}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" />
            {formatEventDate(new Date(event.startsAt))}
          </span>
        </div>

        <div className="mt-1 text-xs text-[var(--muted)] inline-flex items-center gap-1 truncate">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">
            {event.venue} • {event.city}
          </span>
        </div>

        {!event.hidden && (
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" />
              <strong className="text-[var(--foreground)] tabular-nums">
                {stats.views.toLocaleString("tr-TR")}
              </strong>
              <span>görüntülenme</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              <strong className="text-[var(--foreground)] tabular-nums">
                {stats.rsvps.toLocaleString("tr-TR")}
              </strong>
              <span>RSVP</span>
            </span>
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center gap-1.5">
          <Link
            href={`/etkinlik/${event.slug}`}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--muted-bg)] transition-colors"
          >
            <Eye className="size-3" />
            Görüntüle
          </Link>
          <button
            type="button"
            disabled
            title="Düzenleme yakında"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Pencil className="size-3" />
            Düzenle
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
          >
            <Trash2 className="size-3" />
            Sil
          </button>
        </div>
      </div>
    </article>
  );
}

function ListSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3"
        >
          <div className="size-20 sm:size-24 shrink-0 rounded-xl bg-[var(--muted-bg)] animate-pulse" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3.5 w-3/4 rounded bg-[var(--muted-bg)] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[var(--muted-bg)] animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-[var(--muted-bg)] animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyAll() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center"
    >
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
        <PartyPopper className="size-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Henüz etkinlik eklemedin</h3>
      <p className="mt-1 text-sm text-[var(--muted)] max-w-sm mx-auto">
        Yayınla butonuna tıkla, ilk etkinliğini birkaç dakikada oluştur.
      </p>
      <Link
        href="/yayinla"
        className="mt-5 inline-flex items-center gap-1.5 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
      >
        <Plus className="size-4" />
        Yayınla
      </Link>
    </motion.div>
  );
}
