import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft, Clock, Globe, Phone, Building2 } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Comments } from "@/components/Comments";
import { EventGallery } from "@/components/EventGallery";
import { EventRouteCard } from "@/components/EventRouteCard";
import { StoryStrip } from "@/components/StoryStrip";
import { LikeButton } from "@/components/LikeButton";
import { ShareButton } from "@/components/ShareButton";
import { EventImage } from "@/components/EventImage";
import { Reveal } from "@/components/motion/Reveal";
import { PageFade } from "@/components/motion/PageFade";
import { getPlaceBySlug } from "@/lib/places";
import { listComments } from "@/lib/comments-store";
import { listPhotos } from "@/lib/gallery-store";
import { auth } from "@/auth";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { PLACE_TYPE_LABELS, type PlaceListItem } from "@/lib/types";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) return { title: "Yer bulunamadı" };
  const desc = place.description?.slice(0, 160) ?? `${place.name}, ${place.city}`;
  const url = `/yer/${place.slug}`;
  const ogImage = place.imageUrl ? absoluteUrl(place.imageUrl) : undefined;
  return {
    title: place.name,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: place.name,
      description: desc,
      type: "website",
      siteName: SITE_NAME,
      url,
      ...(ogImage && { images: [{ url: ogImage }] }),
    },
  };
}

const SCHEMA_TYPE: Record<string, string> = {
  MUZE: "Museum",
  OREN_YERI: "LandmarksOrHistoricalBuildings",
  SARAY: "LandmarksOrHistoricalBuildings",
  DIGER: "TouristAttraction",
};

function withHttp(u: string): string {
  const v = u.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^@/, "")}`;
}

function buildJsonLd(place: PlaceListItem) {
  const url = absoluteUrl(`/yer/${place.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[place.type] ?? "TouristAttraction",
    name: place.name,
    url,
    ...(place.imageUrl && { image: [absoluteUrl(place.imageUrl)] }),
    ...(place.description && { description: place.description }),
    address: {
      "@type": "PostalAddress",
      addressLocality: place.city,
      ...(place.address && { streetAddress: place.address }),
      addressCountry: "TR",
    },
    ...(place.openTime && place.closeTime && {
      openingHours: `Mo-Su ${place.openTime}-${place.closeTime}`,
    }),
    ...(place.website && { sameAs: [withHttp(place.website)] }),
  };
}

export default async function PlaceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) notFound();

  const session = await auth().catch(() => null);
  const isLoggedIn = !!session?.user;
  const viewerEmail = session?.user?.email ?? "anon";
  const [initialComments, initialPhotos] = await Promise.all([
    listComments(place.slug, viewerEmail),
    listPhotos(place.slug),
  ]);

  const hours =
    place.openTime && place.closeTime ? `${place.openTime} – ${place.closeTime}` : place.openTime ?? null;
  const jsonLd = buildJsonLd(place);

  return (
    <PageFade>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-[var(--muted-bg)]">
              <EventImage
                src={place.imageUrl}
                alt={place.name}
                category="SERGI"
                fill
                priority
                sizes="(min-width: 1024px) 70vw, 100vw"
                className="object-cover"
              />
            </div>

            <header className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="category">{PLACE_TYPE_LABELS[place.type] ?? "Gezilecek Yer"}</Badge>
                <Badge variant="outline">Kültür Bakanlığı</Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{place.name}</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-[var(--muted)]">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4" /> {place.district ? `${place.district}, ${place.city}` : place.city}
                </span>
                {hours && (
                  <span className="inline-flex items-center gap-2">
                    <Clock className="size-4" /> {hours}
                  </span>
                )}
              </div>
            </header>

            {place.description && (
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h2 className="font-semibold mb-2">Hakkında</h2>
                <p className="text-sm leading-relaxed text-[var(--muted)] whitespace-pre-line">{place.description}</p>
              </section>
            )}

            <StoryStrip eventSlug={place.slug} eventTitle={place.name} />

            <Reveal>
              <EventGallery
                slug={place.slug}
                initialPhotos={initialPhotos}
                isLoggedIn={isLoggedIn}
                hasRsvp={false}
                userEmail={session?.user?.email ?? null}
              />
            </Reveal>

            <EventRouteCard venue={place.name} city={place.city} district={place.district} />

            <Reveal>
              <Comments
                slug={place.slug}
                isLoggedIn={isLoggedIn}
                authorName={session?.user?.name ?? null}
                viewerUsername={viewerEmail}
                initialItems={initialComments}
              />
            </Reveal>
          </div>

          <aside className="space-y-5 md:order-last lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Ziyaret Bilgisi</div>
                {hours ? (
                  <div className="mt-1 text-2xl font-bold inline-flex items-center gap-2">
                    <Clock className="size-5" /> {hours}
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-[var(--muted)]">Ziyaret saatleri için web sitesini kontrol edin.</div>
                )}
              </div>

              {place.address && (
                <div className="border-t border-[var(--border)] pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Adres</div>
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 className="size-4 mt-0.5 shrink-0 text-[var(--muted)]" />
                    <span>{place.address}</span>
                  </div>
                </div>
              )}

              {(place.website || place.phone) && (
                <div className="space-y-2 border-t border-[var(--border)] pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">İletişim</div>
                  <div className="flex flex-wrap gap-2">
                    {place.phone && (
                      <a
                        href={`tel:${place.phone.replace(/\s+/g, "")}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted-bg)] transition-colors"
                      >
                        <Phone className="size-3.5" /> {place.phone}
                      </a>
                    )}
                    {place.website && (
                      <a
                        href={withHttp(place.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted-bg)] transition-colors"
                      >
                        <Globe className="size-3.5" /> Web sitesi
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--border)] pt-4">
                <div className="flex items-stretch justify-stretch">
                  <LikeButton eventId={place.id} initialCount={0} size="lg" showCount={false} className="!w-full !justify-center" />
                </div>
                <ShareButton
                  title={place.name}
                  url={`/yer/${place.slug}`}
                  description={place.description ?? undefined}
                  imageUrl={place.imageUrl ?? undefined}
                  city={place.city}
                  className="!flex-col !gap-1 !py-2.5 !text-xs"
                />
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-10">
          <Link href="/yerler" className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline">
            <ArrowLeft className="size-4 rtl:rotate-180" /> Tüm gezilecek yerlere dön
          </Link>
        </div>
      </article>
    </PageFade>
  );
}
