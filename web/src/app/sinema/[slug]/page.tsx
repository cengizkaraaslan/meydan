import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MovieImage } from "@/components/MovieImage";
import {
  Clock,
  Calendar,
  Star,
  ArrowLeft,
  PlayCircle,
  MapPin,
  Users,
  ExternalLink,
} from "lucide-react";
import { MovieRsvpButtons } from "@/components/MovieRsvpButtons";
import { MovieBuddyMatchmaker } from "@/components/MovieBuddyMatchmaker";
import { getMovieBySlug } from "@/lib/cinema-data";
import { auth } from "@/auth";
import { getRsvp } from "@/lib/rsvp-store";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const movie = getMovieBySlug(slug);
  if (!movie) return { title: "Film bulunamadı — MeydanFest" };
  const desc = movie.synopsis.slice(0, 160);
  return {
    title: `${movie.title} — Sinema · MeydanFest`,
    description: desc,
    openGraph: {
      title: movie.title,
      description: desc,
      type: "video.movie",
      siteName: "MeydanFest",
      images: movie.backdropUrl ? [{ url: movie.backdropUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: movie.title,
      description: desc,
    },
  };
}

export default async function MovieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sehir?: string }>;
}) {
  const { slug } = await params;
  const { sehir } = await searchParams;
  const movie = getMovieBySlug(slug);
  if (!movie) notFound();

  const buddyCity = sehir && movie.showtimes.some((s) => s.city === sehir)
    ? sehir
    : movie.showtimes[0]?.city ?? "İstanbul";

  const session = await auth().catch(() => null);
  const namespacedSlug = `movie:${slug}`;
  const userRsvp = session?.user?.email ? await getRsvp(session.user.email, namespacedSlug) : null;
  const myRsvp = userRsvp?.status ?? null;

  // Şehir bazında gruplandırılmış seanslar
  const cityGroups = groupShowtimesByCity(movie.showtimes);

  // Deterministik "kim gidiyor" sayısı (mock).
  const attendeeCount = 40 + (hashCode(slug) % 320);

  return (
    <article>
      {/* Backdrop hero */}
      <div className="relative h-64 sm:h-80 lg:h-96 w-full overflow-hidden bg-[var(--muted-bg)]">
        {movie.backdropUrl ? (
          <MovieImage
            src={movie.backdropUrl}
            alt={movie.title}
            title={movie.title}
            sizes="100vw"
            priority
            imgClassName="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/30 via-[var(--accent)]/20 to-fuchsia-500/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/30 to-transparent" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-32 relative pb-12">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6 sm:gap-8 items-start">
          {/* Poster */}
          <div className="relative aspect-[2/3] w-44 sm:w-56 lg:w-full rounded-2xl overflow-hidden shadow-2xl border border-[var(--border)] bg-[var(--muted-bg)]">
            <MovieImage
              src={movie.posterUrl}
              fallbackSrc={movie.backdropUrl}
              alt={movie.title}
              title={movie.title}
              priority
              sizes="(min-width: 1024px) 280px, 220px"
              imgClassName="object-cover"
            />
          </div>

          {/* Title block */}
          <div className="space-y-3 lg:pt-32">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-[var(--primary)]/15 text-[var(--primary)] px-2 py-0.5 text-xs font-semibold">
                Vizyonda
              </span>
              <span className="rounded-md bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 text-xs font-medium">
                {movie.ageRating}
              </span>
              {movie.genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-[var(--muted-bg)] px-2.5 py-0.5 text-xs font-medium"
                >
                  {g}
                </span>
              ))}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              {movie.title}
            </h1>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <div className="text-sm italic text-[var(--muted)]">{movie.originalTitle}</div>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" />
                {Math.floor(movie.durationMin / 60)}s {movie.durationMin % 60}d
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" />
                {new Date(movie.releaseDate).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-4 fill-yellow-500 text-yellow-500" />
                <strong className="text-[var(--foreground)]">{movie.rating.toFixed(1)}</strong> / 10
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[var(--foreground)]">Yön.</span> {movie.director}
              </span>
            </div>

            {movie.trailerUrl && (
              <a
                href={movie.trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-semibold hover:opacity-95 transition-opacity"
              >
                <PlayCircle className="size-4" />
                Fragmanı İzle
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-10 grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="font-semibold mb-3">Özet</h2>
              <p className="text-sm leading-relaxed text-[var(--muted)]">{movie.synopsis}</p>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="font-semibold mb-4">Künye</h2>
              <dl className="grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Vizyon Tarihi</dt>
                  <dd className="font-medium">
                    {new Date(movie.releaseDate).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Yönetmen</dt>
                  <dd className="font-medium">{movie.director}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Süre</dt>
                  <dd className="font-medium">
                    {Math.floor(movie.durationMin / 60)} saat {movie.durationMin % 60} dk
                  </dd>
                </div>
                <div className="sm:col-span-3">
                  <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">Oyuncular</dt>
                  <dd className="font-medium">{movie.cast.join(", ")}</dd>
                </div>
              </dl>
            </section>

            <ShowtimesSection groups={cityGroups} movieSlug={slug} />

            <MovieBuddyMatchmaker
              seedKey={`movie:${slug}:${buddyCity}`}
              city={buddyCity}
              genres={movie.genres}
            />

            {/* "Sinemaya kim gidiyor?" strip */}
            <section className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/5 to-transparent p-5 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)] shrink-0">
                <Users className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="font-semibold">
                  Sinemaya{" "}
                  <strong className="text-[var(--primary)]">
                    {attendeeCount.toLocaleString("tr-TR")}
                  </strong>{" "}
                  kişi gidiyor
                </div>
                <div className="text-xs text-[var(--muted)] truncate">
                  Sen de katılırsan listeye ekleniyorsun — buddy önerileri otomatik güncellenir.
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Sen ne yapacaksın?</div>
                <div className="mt-1 text-sm font-medium">Bu filme katılım durumun</div>
              </div>

              <MovieRsvpButtons slug={slug} initial={myRsvp} />

              {movie.trailerUrl && (
                <a
                  href={movie.trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
                >
                  <PlayCircle className="size-4" />
                  Fragmanı izle
                </a>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h3 className="text-sm font-semibold mb-3 inline-flex items-center gap-2">
                <MapPin className="size-4" /> Şehirler
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(movie.showtimes.map((s) => s.city))).map((c) => (
                  <Link
                    key={c}
                    href={`/sinema/${slug}?sehir=${encodeURIComponent(c)}#seanslar`}
                    className={
                      "rounded-full px-3 py-1 text-xs font-medium border transition-colors " +
                      (c === buddyCity
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                        : "bg-[var(--muted-bg)] border-[var(--border)] hover:bg-[var(--card)]")
                    }
                    scroll={false}
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-10">
          <Link
            href="/sinema"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" /> Tüm filmlere dön
          </Link>
        </div>
      </div>
    </article>
  );
}

interface CityGroup {
  city: string;
  theaters: { theater: string; times: string[] }[];
}

function groupShowtimesByCity(
  showtimes: { city: string; theater: string; times: string[] }[],
): CityGroup[] {
  const map = new Map<string, { theater: string; times: string[] }[]>();
  for (const s of showtimes) {
    const arr = map.get(s.city) ?? [];
    arr.push({ theater: s.theater, times: s.times });
    map.set(s.city, arr);
  }
  return Array.from(map.entries()).map(([city, theaters]) => ({ city, theaters }));
}

function ShowtimesSection({ groups, movieSlug }: { groups: CityGroup[]; movieSlug: string }) {
  return (
    <section id="seanslar" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 scroll-mt-24">
      <h2 className="font-semibold mb-4 inline-flex items-center gap-2">
        🎟️ Seanslar
      </h2>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.city}>
            <h3 className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
              <MapPin className="size-3.5" /> {g.city}
            </h3>
            <ul className="space-y-3">
              {g.theaters.map((t) => (
                <li key={`${g.city}-${t.theater}`} className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 p-3">
                  <div className="text-sm font-medium mb-2">{t.theater}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.times.map((time) => (
                      <Link
                        key={time}
                        href={`/sinema/${movieSlug}?sehir=${encodeURIComponent(g.city)}#seanslar`}
                        className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                        scroll={false}
                        title={`Bu seansa katılıyor musun? ${g.city} • ${t.theater} • ${time}`}
                      >
                        {time}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Bir seansa &quot;Katılacağım&quot; demek için sağ taraftaki butonu kullan — tüm seansları kapsar.
      </p>
    </section>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}
