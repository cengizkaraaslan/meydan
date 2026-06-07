import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PartyPopper, Calendar, MapPin, MessageSquare } from "lucide-react";
import {
  isSaturday,
  isSunday,
  nextSaturday,
  nextSunday,
  endOfDay,
  startOfDay,
} from "date-fns";
import { getEvents } from "@/lib/events";
import { getWeekendBuddies, type Buddy } from "@/lib/buddy-seed";
import { CATEGORY_LABELS, type EventListItem } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { cityLocative } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEFAULT_CITY = "İstanbul";
const LOCATION_COOKIE = "meydanfest_city";

export const metadata: Metadata = {
  title: "Bu Hafta Sonu · MeydanFest",
  description:
    "Bu cumartesi ve pazar şehrinde hangi etkinlikler var? Sana eşleşen 3 kişiyle birlikte çık.",
};

/** TR zaman bölgesinde "şimdi"den sonraki Cumartesi ve Pazar 00:00 → 23:59 aralığı. */
function getThisWeekendRange(now: Date): { satStart: Date; satEnd: Date; sunStart: Date; sunEnd: Date } {
  const sat = isSaturday(now) ? now : nextSaturday(now);
  const sun = isSunday(now) ? now : nextSunday(now);
  return {
    satStart: startOfDay(sat),
    satEnd: endOfDay(sat),
    sunStart: startOfDay(sun),
    sunEnd: endOfDay(sun),
  };
}

function inRange(d: Date, start: Date, end: Date): boolean {
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

async function getUserCity(): Promise<string> {
  const store = await cookies();
  const raw = store.get(LOCATION_COOKIE)?.value;
  return raw ? decodeURIComponent(raw) : DEFAULT_CITY;
}

/**
 * Önce kullanıcının şehrinde dene → boşsa varsayılan şehir (İstanbul).
 * Hala boşsa "hafta sonu sakin" empty state.
 */
async function resolveWeekendEvents(satStart: Date, sunEnd: Date) {
  const wanted = await getUserCity();
  let usedCity = wanted;
  let isFallback = false;

  // 1. Kullanıcının şehri
  let { events } = await getEvents({
    city: wanted,
    from: satStart,
    to: sunEnd,
    pageSize: 200,
  });

  // 2. Boşsa İstanbul fallback (eğer wanted zaten İstanbul değilse)
  if (events.length === 0 && wanted !== DEFAULT_CITY) {
    const fallback = await getEvents({
      city: DEFAULT_CITY,
      from: satStart,
      to: sunEnd,
      pageSize: 200,
    });
    events = fallback.events;
    usedCity = DEFAULT_CITY;
    isFallback = true;
  }

  return { events, usedCity, isFallback, wantedCity: wanted };
}

export default async function HaftaSonuPage() {
  const now = new Date();
  const { satStart, satEnd, sunStart, sunEnd } = getThisWeekendRange(now);
  const { events, usedCity, isFallback, wantedCity } = await resolveWeekendEvents(
    satStart,
    sunEnd,
  );

  const saturdayEvents = events.filter((e) => inRange(e.startsAt, satStart, satEnd));
  const sundayEvents = events.filter((e) => inRange(e.startsAt, sunStart, sunEnd));

  if (saturdayEvents.length === 0 && sundayEvents.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="text-5xl mb-4">🛋️</div>
        <h1 className="text-2xl font-bold mb-2">Bu hafta sonu sakin</h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          {usedCity} için hafta sonu yayında etkinlik yok. İlerideki tarihlere bak:
        </p>
        <Link
          href="/etkinlikler"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2.5 text-sm font-medium hover:opacity-95"
        >
          Tüm Etkinlikler
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-10">
      <Hero
        city={usedCity}
        isFallback={isFallback}
        wantedCity={wantedCity}
        saturdayCount={saturdayEvents.length}
        sundayCount={sundayEvents.length}
      />

      {saturdayEvents.length > 0 && (
        <DaySection
          title="Cumartesi"
          emoji="🥁"
          date={satStart}
          events={saturdayEvents}
          city={usedCity}
        />
      )}

      {sundayEvents.length > 0 && (
        <DaySection
          title="Pazar"
          emoji="🌅"
          date={sunStart}
          events={sundayEvents}
          city={usedCity}
        />
      )}
    </div>
  );
}

function Hero({
  city,
  isFallback,
  wantedCity,
  saturdayCount,
  sundayCount,
}: {
  city: string;
  isFallback: boolean;
  wantedCity: string;
  saturdayCount: number;
  sundayCount: number;
}) {
  return (
    <header className="rounded-3xl bg-gradient-to-br from-[var(--primary)]/15 via-[var(--accent)]/10 to-transparent border border-[var(--border)] p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-md">
          <PartyPopper className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            🎉 Bu Hafta Sonu · {city}
          </h1>
          {isFallback && (
            <p className="text-xs text-[var(--muted)] inline-flex items-center gap-1 mt-1">
              <MapPin className="size-3" />
              {cityLocative(wantedCity)} etkinlik yok — sana {city} öneriyoruz
            </p>
          )}
        </div>
      </div>
      <p className="text-base text-[var(--muted)] max-w-2xl">
        Cumartesi <strong className="text-[var(--foreground)]">{saturdayCount}</strong> etkinlik,
        Pazar <strong className="text-[var(--foreground)]">{sundayCount}</strong> etkinlik — biriyle çık.
      </p>
    </header>
  );
}

function DaySection({
  title,
  emoji,
  date,
  events,
  city,
}: {
  title: string;
  emoji: string;
  date: Date;
  events: EventListItem[];
  city: string;
}) {
  const dayLabel = date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });
  const displayed = events.slice(0, 6);
  const buddies = getWeekendBuddies(city, 3);

  return (
    <section>
      <header className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight inline-flex items-center gap-2">
            <span aria-hidden>{emoji}</span> {title}
          </h2>
          <p className="text-sm text-[var(--muted)] inline-flex items-center gap-1.5 mt-1">
            <Calendar className="size-3.5" />
            {dayLabel} • {events.length} etkinlik
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {displayed.map((event) => (
          <EventMiniCard key={event.id} event={event} />
        ))}
      </div>

      <BuddyStrip city={city} buddies={buddies} />
    </section>
  );
}

function EventMiniCard({ event }: { event: EventListItem }) {
  const day = event.startsAt.toLocaleDateString("tr-TR", { day: "numeric" });
  const month = event.startsAt.toLocaleDateString("tr-TR", { month: "short" });
  const time = event.startsAt.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/etkinlik/${event.slug}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5 transition-shadow"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="grid size-12 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
          <div className="text-base font-bold leading-none">{day}</div>
          <div className="text-[10px] tracking-wider text-[var(--muted)] -mt-0.5">{month}</div>
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 text-[10px] font-medium">
            {CATEGORY_LABELS[event.category]}
          </span>
          <div className="text-xs text-[var(--muted)] mt-1">{time}</div>
        </div>
      </div>
      <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-[var(--primary)] transition-colors mb-2">
        {event.title}
      </h3>
      <div className="mt-auto flex items-center gap-1 text-xs text-[var(--muted)] truncate">
        <MapPin className="size-3 shrink-0" />
        <span className="truncate">{event.venue} • {event.city}</span>
      </div>
    </Link>
  );
}

function BuddyStrip({ city, buddies }: { city: string; buddies: Buddy[] }) {
  if (buddies.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/5 to-transparent p-4">
      <div className="mb-3 text-xs uppercase tracking-wider text-[var(--muted)] font-semibold">
        ✨ Sana eşleşen {buddies.length} kişi · {city}
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {buddies.map((b) => (
          <li
            key={b.username}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
          >
            <Avatar
              src={b.avatarUrl}
              name={b.name}
              color={b.color}
              size="size-11"
              className="shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{b.name}</div>
              <div className="text-xs text-[var(--muted)] truncate">{b.bio}</div>
            </div>
            <Link
              href={`/mesaj/${b.username}`}
              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-xs font-medium hover:opacity-95 transition-opacity"
            >
              <MessageSquare className="size-3.5" />
              Mesaj at
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
