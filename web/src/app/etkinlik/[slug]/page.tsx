import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Calendar, MapPin, ExternalLink, BellRing, ArrowLeft, CalendarPlus, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { RsvpButtons } from "@/components/RsvpButtons";
import { Comments } from "@/components/Comments";
import { AttendeesList } from "@/components/AttendeesList";
import { BuddyMatchmaker } from "@/components/BuddyMatchmaker";
import { AiSummary } from "@/components/AiSummary";
import { CarpoolList } from "@/components/CarpoolList";
import { EventGallery } from "@/components/EventGallery";
import { EventRouteCard } from "@/components/EventRouteCard";
import { StoryStrip } from "@/components/StoryStrip";
import { LikeButton } from "@/components/LikeButton";
import { ShareButton } from "@/components/ShareButton";
import { EventImage } from "@/components/EventImage";
import { getEventBySlug, getPastEditions } from "@/lib/events";
import { getEventWeather } from "@/lib/weather";
import { EventTweets } from "@/components/EventTweets";
import { PastEditions } from "@/components/PastEditions";
import { Reveal } from "@/components/motion/Reveal";
import { isTruncated, getFullDescription } from "@/lib/enrich-description";
import { formatEventDate, formatPrice } from "@/lib/utils";
import { SOURCE_LABELS, isUniversitySource } from "@/lib/types";
import { seedLikeCount, seedLikersFor } from "@/lib/social-data";
import { auth } from "@/auth";
import { getRsvp } from "@/lib/rsvp-store";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import type { EventCategory, EventListItem } from "@/lib/types";
import { listComments } from "@/lib/comments-store";
import { listPhotos } from "@/lib/gallery-store";
import { listReviews, summarize as summarizeReviews } from "@/lib/reviews-store";
import { Reviews } from "@/components/Reviews";
import { Avatar } from "@/components/ui/Avatar";
import { PageFade } from "@/components/motion/PageFade";
import { CheckInButton } from "@/components/CheckInButton";
import {
  getCheckInCountForEvent,
  hasCheckedIn,
  listCheckInsForEvent,
} from "@/lib/checkin-store";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Etkinlik bulunamadı" };
  const desc = event.description?.slice(0, 160) ?? `${event.venue}, ${event.city}`;
  const url = `/etkinlik/${event.slug}`;
  const ogImage = absoluteUrl(event.imageUrl ?? `${url}/opengraph-image`);
  // title.template (layout) zaten "— MeydanFest" ekler → burada sadece başlık
  return {
    title: event.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: event.title,
      description: desc,
      type: "website",
      siteName: SITE_NAME,
      url,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description: desc,
      images: [ogImage],
    },
  };
}

const SCHEMA_TYPE: Record<EventCategory, string> = {
  KONSER: "MusicEvent",
  FESTIVAL: "Festival",
  TIYATRO: "TheaterEvent",
  STANDUP: "ComedyEvent",
  SPOR: "SportsEvent",
  SERGI: "ExhibitionEvent",
  ATOLYE: "EducationEvent",
  COCUK: "ChildrensEvent",
  FUAR: "ExhibitionEvent",
  DIGER: "Event",
};

/** schema.org/Event JSON-LD — Google rich results + arama görünürlüğü. */
function buildEventJsonLd(event: EventListItem, reviewSummary: { count: number; average: number }) {
  const url = absoluteUrl(`/etkinlik/${event.slug}`);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[event.category] ?? "Event",
    name: event.title,
    url,
    startDate: event.startsAt.toISOString(),
    ...(event.endsAt && { endDate: event.endsAt.toISOString() }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city,
        ...(event.district && { addressRegion: event.district }),
        addressCountry: "TR",
      },
    },
    organizer: {
      "@type": "Organization",
      name: SOURCE_LABELS[event.source] ?? String(event.source),
    },
    ...(event.imageUrl && { image: [absoluteUrl(event.imageUrl)] }),
    ...(event.description && { description: event.description }),
    ...(event.artist && {
      performer: { "@type": "PerformingGroup", name: event.artist },
    }),
    offers: {
      "@type": "Offer",
      url: event.ticketUrl ?? url,
      price: event.isFree ? 0 : event.priceMin ?? undefined,
      priceCurrency: "TRY",
      availability: "https://schema.org/InStock",
    },
    ...(reviewSummary.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviewSummary.average.toFixed(1),
        reviewCount: reviewSummary.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
  return jsonLd;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations("event");
  const tCat = await getTranslations("categories");
  const tCommon = await getTranslations("common");

  const session = await auth().catch(() => null);
  const isLoggedIn = !!session?.user;
  const userRsvp = session?.user?.email ? await getRsvp(session.user.email, slug) : null;
  const myRsvp = userRsvp?.status ?? null;
  const hasRsvp = userRsvp?.status === "GOING" || userRsvp?.status === "MAYBE";

  const likeCount = seedLikeCount(event.id);
  const topLikers = seedLikersFor(event.id).slice(0, 5);
  const viewerEmail = session?.user?.email ?? "anon";
  const [initialComments, initialPhotos, initialReviews, reviewSummary, checkInCount, checkInList, pastEditions, weather] =
    await Promise.all([
      listComments(event.slug, viewerEmail),
      listPhotos(event.slug),
      listReviews(event.slug, viewerEmail),
      summarizeReviews(event.slug),
      getCheckInCountForEvent(event.slug),
      listCheckInsForEvent(event.slug),
      getPastEditions(event),
      getEventWeather(event.city, event.startsAt),
    ]);
  const myReview = initialReviews.find((r) => r.isMine) ?? null;
  const checkedInMine = session?.user?.email
    ? await hasCheckedIn(session.user.email, event.slug)
    : false;

  // Açıklama kesikse ("[...]" / "…") kaynağın detay sayfasından tam metni çek (önbellekli).
  const fullDescription =
    isTruncated(event.description) && event.ticketUrl
      ? (await getFullDescription(event.ticketUrl)) ?? event.description
      : event.description;

  const eventJsonLd = buildEventJsonLd(event, reviewSummary);

  return (
    <PageFade>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <article className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-[var(--muted-bg)]">
            <EventImage
              src={event.imageUrl}
              alt={event.title}
              category={event.category}
              isFree={event.isFree}
              fill
              priority
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="object-cover"
            />
          </div>

          <header className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="category">{tCat(event.category)}</Badge>
              {isUniversitySource(event.source) ? (
                <Badge variant="default" className="bg-indigo-600/90 text-white border-transparent">🎓 Öğrenciye açık</Badge>
              ) : event.isFree ? (
                <Badge variant="free">{tCommon("free")}</Badge>
              ) : (
                <Badge variant="default">{formatPrice(event.priceMin, event.priceMax, event.isFree)}</Badge>
              )}
              <Badge variant="outline">{SOURCE_LABELS[event.source]}</Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              {event.title}
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-[var(--muted)]">
              <span className="inline-flex items-center gap-2">
                <Calendar className="size-4" /> {formatEventDate(event.startsAt)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4" /> {event.venue}, {event.city}
              </span>
              {weather && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 backdrop-blur px-2.5 py-1 text-xs font-medium border border-[var(--border)]"
                  title={`${weather.label} • ${weather.tempMin}° / ${weather.tempMax}°C`}
                >
                  <span aria-hidden className="text-base leading-none">{weather.emoji}</span>
                  <span className="tabular-nums font-semibold text-[var(--foreground)]">
                    {weather.tempMax}° / {weather.tempMin}°
                  </span>
                  <span className="text-[var(--muted)] hidden sm:inline">• {weather.label}</span>
                </span>
              )}
              {reviewSummary.count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-[var(--accent)] text-[var(--accent)]" />
                  <strong className="text-[var(--foreground)]">{reviewSummary.average.toFixed(1)}</strong>
                  <span className="text-xs">({reviewSummary.count})</span>
                </span>
              )}
            </div>

            <Link href={`/etkinlik/${event.slug}/begenenler`} className="group inline-flex items-center gap-3 mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 hover:bg-[var(--muted-bg)] transition-colors">
              <div className="flex -space-x-2.5">
                {topLikers.map((u) => (
                  <Avatar
                    key={u.username}
                    src={u.avatarUrl}
                    name={u.name}
                    color={u.color}
                    size="size-8"
                    ring
                  />
                ))}
              </div>
              <div className="text-sm">
                <strong className="text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                  {likeCount.toLocaleString("tr-TR")}
                </strong>{" "}
                <span className="text-[var(--muted)]">kişi beğendi</span>
              </div>
            </Link>
          </header>

          {isUniversitySource(event.source) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-sm">
              <span className="text-lg leading-none shrink-0">🎓</span>
              <p>
                <strong>Üniversite etkinliği.</strong>{" "}
                <span className="text-[var(--muted)]">
                  Bu etkinlik yalnızca {SOURCE_LABELS[event.source] ?? "ilgili üniversite"} öğrencileri/mensupları için olabilir. Katılım koşullarını kaynaktan teyit et.
                </span>
              </p>
            </div>
          )}

          {fullDescription && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="font-semibold mb-2">{t("details_title")}</h2>
              <p className="text-sm leading-relaxed text-[var(--muted)] whitespace-pre-line">{fullDescription}</p>
            </section>
          )}

          <StoryStrip eventSlug={event.slug} />

          <AiSummary slug={event.slug} />

          <CheckInButton
            slug={event.slug}
            initialCount={checkInCount}
            initialMine={checkedInMine}
            initialList={checkInList}
          />

          <BuddyMatchmaker
            eventId={event.id}
            city={event.city}
            category={event.category}
            eventSlug={event.slug}
          />

          <CarpoolList eventSlug={event.slug} />

          <Reveal>
            <EventGallery
              slug={event.slug}
              initialPhotos={initialPhotos}
              isLoggedIn={isLoggedIn}
              hasRsvp={hasRsvp}
              userEmail={session?.user?.email ?? null}
            />
          </Reveal>

          <EventRouteCard
            venue={event.venue}
            city={event.city}
            district={event.district}
          />

          <Reveal>
            <Reviews
              slug={event.slug}
              isLoggedIn={isLoggedIn}
              initialItems={initialReviews}
              initialSummary={reviewSummary}
              initialMine={myReview}
            />
          </Reveal>

          <Reveal>
            <Comments
              slug={event.slug}
              isLoggedIn={isLoggedIn}
              authorName={session?.user?.name ?? null}
              viewerUsername={viewerEmail}
              initialItems={initialComments}
            />
          </Reveal>

          {pastEditions.length > 0 && <PastEditions events={pastEditions} />}

          <EventTweets query={`${event.title} ${event.city}`} />
        </div>

        <aside className="space-y-5 md:order-last lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                {isUniversitySource(event.source) ? "Katılım" : "Fiyat"}
              </div>
              <div className="mt-1 text-2xl font-bold">
                {isUniversitySource(event.source)
                  ? "🎓 Öğrenciye açık"
                  : formatPrice(event.priceMin, event.priceMax, event.isFree)}
              </div>
              {isUniversitySource(event.source) && (
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Üniversite etkinliği — genellikle üniversite öğrencilerine açıktır, bilet gerekmez.
                </div>
              )}
            </div>

            <RsvpButtons slug={event.slug} initial={myRsvp} isLoggedIn={isLoggedIn} />

            {event.ticketUrl && (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-3 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
              >
                {t("ticket_cta")}
                <ExternalLink className="size-4" />
              </a>
            )}

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-stretch justify-stretch">
                <LikeButton eventId={event.id} initialCount={likeCount} size="lg" showCount={false} className="!w-full !justify-center" />
              </div>
              <button type="button" className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] py-2.5 hover:bg-[var(--muted-bg)] transition-colors">
                <BellRing className="size-4" />
                <span>{t("price_alert")}</span>
              </button>
              <ShareButton
                title={event.title}
                url={`/etkinlik/${event.slug}`}
                description={event.description ?? undefined}
                imageUrl={event.imageUrl ?? `/etkinlik/${event.slug}/opengraph-image`}
                city={event.city}
                date={formatEventDate(event.startsAt)}
                className="!flex-col !gap-1 !py-2.5 !text-xs"
              />
            </div>

            <a
              href={`/api/etkinlik/${event.slug}/ics`}
              download
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
            >
              <CalendarPlus className="size-4" />
              Takvime ekle
            </a>
          </div>

          <AttendeesList count={event.attendeeCount ?? 0} />
        </aside>
      </div>

        <div className="mt-10">
          <Link href="/etkinlikler" className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline">
            <ArrowLeft className="size-4 rtl:rotate-180" /> Tüm etkinliklere dön
          </Link>
        </div>
      </article>
    </PageFade>
  );
}
