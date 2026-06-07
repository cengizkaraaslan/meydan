import Link from "next/link";
import { Star, Clock } from "lucide-react";
import { MovieImage } from "./MovieImage";
import type { CinemaMovie } from "@/lib/cinema-data";

export function MovieCard({ movie }: { movie: CinemaMovie }) {
  return (
    <Link
      href={`/sinema/${movie.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/5"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-[var(--muted-bg)]">
        <MovieImage
          src={movie.posterUrl}
          fallbackSrc={movie.backdropUrl}
          alt={movie.title}
          title={movie.title}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Rating badge top-end */}
        <div className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-[11px] font-semibold text-white">
          <Star className="size-3 fill-yellow-400 text-yellow-400" />
          {movie.rating.toFixed(1)}
        </div>

        {/* Age rating */}
        <div className="absolute start-2 top-2 rounded-md bg-white/95 text-black px-1.5 py-0.5 text-[10px] font-bold tracking-wide">
          {movie.ageRating}
        </div>

        {/* Title overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <h3 className="font-semibold text-sm sm:text-base leading-tight line-clamp-2 drop-shadow-md">
            {movie.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/85">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {Math.floor(movie.durationMin / 60)}s {movie.durationMin % 60}d
            </span>
            <span className="truncate">{movie.genres.slice(0, 2).join(" • ")}</span>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-semibold shadow-lg">
            Detaya git →
          </span>
        </div>
      </div>
    </Link>
  );
}
