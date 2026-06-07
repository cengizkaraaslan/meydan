import type { Metadata } from "next";
import Link from "next/link";
import { Film, ArrowRight } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { PageFade } from "@/components/motion/PageFade";
import { CityFilterChips } from "@/components/CityFilterChips";
import {
  CINEMA_MOVIES,
  getMoviesByCity,
  getCinemaCities,
} from "@/lib/cinema-data";
import { cityLocative } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "🎬 Vizyondaki Filmler — Sinema · MeydanFest",
  description:
    "Türkiye'de bu hafta vizyonda olan filmler. Sinemaya yalnız mı gidiyorsun? Buddy bulalım, birlikte gidin.",
  openGraph: {
    title: "🎬 Vizyondaki Filmler — MeydanFest Sinema",
    description: "Türkiye'de bu hafta vizyonda olan filmler. Birlikte gidecek bir buddy bul.",
    type: "website",
    siteName: "MeydanFest",
  },
};

export default async function SinemaPage({
  searchParams,
}: {
  searchParams: Promise<{ sehir?: string }>;
}) {
  const { sehir } = await searchParams;
  const allCities = getCinemaCities();
  const selectedCity = sehir && allCities.includes(sehir) ? sehir : null;
  const movies = selectedCity ? getMoviesByCity(selectedCity) : CINEMA_MOVIES;

  return (
    <PageFade className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      <Hero count={movies.length} selectedCity={selectedCity} />

      <CityFilterChips cities={allCities} selectedCity={selectedCity} />

      {movies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
          <div className="text-5xl mb-3">🎬</div>
          <h2 className="font-semibold text-lg">
            {selectedCity ? `${cityLocative(selectedCity)} gösterilen film bulunamadı.` : "Vizyonda film yok."}
          </h2>
          <p className="text-sm text-[var(--muted)] mt-2">Başka bir şehir seç ya da yakında tekrar bak.</p>
          <Link
            href="/sinema"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
          >
            Tüm filmleri gör <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
          {movies.map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>
      )}
    </PageFade>
  );
}

function Hero({ count, selectedCity }: { count: number; selectedCity: string | null }) {
  return (
    <header className="rounded-3xl bg-gradient-to-br from-[var(--primary)]/15 via-[var(--accent)]/10 to-transparent border border-[var(--border)] p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-md">
          <Film className="size-6" />
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">🎬 Vizyondaki Filmler</h1>
      </div>
      <p className="text-base text-[var(--muted)] max-w-2xl">
        Sinemaya yalnız mı gidiyorsun? <strong className="text-[var(--foreground)]">Buddy bulalım.</strong>{" "}
        {selectedCity ? (
          <>
            <strong className="text-[var(--foreground)]">{cityLocative(selectedCity)}</strong> gösterimde olan{" "}
            <strong className="text-[var(--foreground)]">{count}</strong> film var.
          </>
        ) : (
          <>
            Şu anda <strong className="text-[var(--foreground)]">{count}</strong> film vizyonda — seansa katılacak biri her zaman vardır.
          </>
        )}
      </p>
    </header>
  );
}

