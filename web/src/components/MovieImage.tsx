"use client";

import { useState } from "react";
import { Film } from "lucide-react";

interface MovieImageProps {
  src: string;
  alt: string;
  title?: string;
  /** İlk URL fail ederse denenecek yedek URL (örn. poster için backdrop) */
  fallbackSrc?: string;
  /** Tailwind className wrapper'da uygulanır */
  className?: string;
  /** "object-cover" gibi <img> üzerinde uygulanacak className'ler */
  imgClassName?: string;
  /** Loading priority — afiş kartlarında lazy yeterli */
  priority?: boolean;
  sizes?: string;
}

/**
 * Film afişi için onError fallback'li görsel.
 *
 * TMDB URL'leri stale olabilir (yeni hash, kaldırılmış vs.) — `<img onError>`
 * tetiklenince placeholder gradient + Film ikonu + başlık gösteririz.
 *
 * Note: next/image yerine native img — TMDB hostname kontrol bypass +
 * onError'da yerel state ile düşür.
 */
export function MovieImage({
  src,
  alt,
  title,
  fallbackSrc,
  className = "",
  imgClassName = "",
  priority = false,
  sizes,
}: MovieImageProps) {
  // 0 = ilk URL, 1 = fallback URL, 2 = gradient placeholder
  const [stage, setStage] = useState(0);

  function handleError() {
    if (stage === 0 && fallbackSrc) setStage(1);
    else setStage(2);
  }

  const currentSrc = stage === 0 ? src : stage === 1 ? fallbackSrc : null;

  if (!currentSrc) {
    return (
      <div
        className={`relative w-full h-full grid place-items-center bg-gradient-to-br from-[var(--primary)]/30 via-[var(--accent)]/20 to-fuchsia-500/30 ${className}`}
        data-fallback="movie-poster"
      >
        <div className="text-center px-3">
          <Film className="mx-auto size-10 sm:size-12 text-white/80 mb-2" strokeWidth={1.5} />
          {title && (
            <div className="text-white text-xs sm:text-sm font-semibold leading-tight line-clamp-3 drop-shadow-md">
              {title}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={currentSrc}
      src={currentSrc}
      alt={alt}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={handleError}
      className={`absolute inset-0 w-full h-full ${imgClassName}`}
    />
  );
}
