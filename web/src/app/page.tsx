import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ArrowRight, MapPin } from "lucide-react";
import { Hero } from "@/components/Hero";
import { EventCard } from "@/components/EventCard";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { CommunitySection } from "@/components/CommunitySection";
import { PageFade } from "@/components/motion/PageFade";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { StoryStrip } from "@/components/StoryStrip";
import { PlaceCard } from "@/components/PlaceCard";
import { getFeaturedEvents, getEvents } from "@/lib/events";
import { getFeaturedPlaces } from "@/lib/places";
import { MOCK_EVENTS } from "@/lib/mock-data";

export const revalidate = 60;

const DEFAULT_CITY = "İstanbul";
const LOCATION_COOKIE = "meydanfest_city";

async function getUserCity(): Promise<string> {
  const store = await cookies();
  const raw = store.get(LOCATION_COOKIE)?.value;
  return raw ? decodeURIComponent(raw) : DEFAULT_CITY;
}

/**
 * O şehirde etkinlik var mı kontrol et — yoksa fallback olarak İstanbul kullan.
 * Bu sayede konum tespit edilse bile etkinlik olmayan şehirde boş sayfa
 * gözükmez; her zaman bir şeyler görünür.
 */
async function resolveCity(): Promise<{ city: string; isFallback: boolean }> {
  const wanted = await getUserCity();
  const { total } = await getEvents({ city: wanted, pageSize: 1 });
  if (total > 0) return { city: wanted, isFallback: false };
  return { city: DEFAULT_CITY, isFallback: true };
}

export default async function HomePage() {
  const totalEvents = MOCK_EVENTS.length;
  const totalSources = new Set(MOCK_EVENTS.map((e) => e.source)).size;
  const totalCities = new Set(MOCK_EVENTS.map((e) => e.city)).size;
  const { city, isFallback } = await resolveCity();

  return (
    <PageFade>
      <Hero totalEvents={totalEvents} totalSources={totalSources} totalCities={totalCities} />
      {isFallback && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mb-4 mt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)]">
            <MapPin className="size-3.5 text-[var(--accent)]" />
            Konumunda etkinlik bulamadık — sana <strong className="text-[var(--foreground)]">{city}</strong> önerilerini gösteriyoruz
          </div>
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        <Suspense fallback={null}>
          <StoryStrip />
        </Suspense>
      </div>
      <FeaturedSection city={city} />
      <CommunitySection />
      <FreeSection city={city} />
      <PlacesSection city={city} />
    </PageFade>
  );
}

async function FeaturedSection({ city }: { city: string }) {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeader
        title={`${t("featured_title")} · ${city}`}
        subtitle={t("featured_subtitle")}
        href={`/etkinlikler?city=${encodeURIComponent(city)}`}
      />
      <Suspense fallback={<EventGridSkeleton />}>
        <FeaturedGrid city={city} />
      </Suspense>
    </section>
  );
}

async function FeaturedGrid({ city }: { city: string }) {
  // Önce featured + şehir filtreli dene, yoksa sadece şehir filtreli
  const featured = await getFeaturedEvents(6);
  const cityFeatured = featured.filter(
    (e) => e.city.toLocaleLowerCase("tr") === city.toLocaleLowerCase("tr"),
  );
  let events = cityFeatured.length > 0 ? cityFeatured : featured;
  if (cityFeatured.length === 0) {
    const { events: cityEvents } = await getEvents({ city, pageSize: 6 });
    if (cityEvents.length > 0) events = cityEvents;
  }
  return (
    <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.slice(0, 6).map((e, i) => (
        <EventCard key={e.id} event={e} index={i} />
      ))}
    </StaggerGrid>
  );
}

async function FreeSection({ city }: { city: string }) {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeader
        title={`🎁 ${t("free_section_title")} · ${city}`}
        subtitle={t("free_section_subtitle")}
        href={`/etkinlikler?free=1&city=${encodeURIComponent(city)}`}
      />
      <Suspense fallback={<EventGridSkeleton />}>
        <FreeGrid city={city} />
      </Suspense>
    </section>
  );
}

async function FreeGrid({ city }: { city: string }) {
  const { events } = await getEvents({ city, freeOnly: true, pageSize: 6 });
  // Şehirde ücretsiz yoksa şehirden + genelden karışık göster
  if (events.length === 0) {
    const { events: any2 } = await getEvents({ freeOnly: true, pageSize: 6 });
    return (
      <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {any2.map((e, i) => (
          <EventCard key={e.id} event={e} index={i} />
        ))}
      </StaggerGrid>
    );
  }
  return (
    <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e, i) => (
        <EventCard key={e.id} event={e} index={i} />
      ))}
    </StaggerGrid>
  );
}

async function PlacesSection({ city }: { city: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeader
        title={`🏛️ Gezilecek Yerler · ${city}`}
        subtitle="Müzeler, örenyerleri ve tarihî mekanlar"
        href={`/yerler?city=${encodeURIComponent(city)}`}
      />
      <Suspense fallback={<EventGridSkeleton />}>
        <PlacesGrid city={city} />
      </Suspense>
    </section>
  );
}

async function PlacesGrid({ city }: { city: string }) {
  const places = await getFeaturedPlaces(6, city);
  if (places.length === 0) return null;
  return (
    <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {places.map((p, i) => (
        <PlaceCard key={p.id} place={p} index={i} />
      ))}
    </StaggerGrid>
  );
}

function EventGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
      <Link
        href={href}
        className="hidden sm:inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline whitespace-nowrap"
      >
        Tümü <ArrowRight className="size-4 rtl:rotate-180" />
      </Link>
    </div>
  );
}
