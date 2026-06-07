"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Grid3x3, ImagePlus, MessageSquare } from "lucide-react";
import type { GalleryPhoto } from "@/lib/gallery-store";
import { PhotoLightbox } from "./PhotoLightbox";

/**
 * Kişinin "duvarı" — etkinliklerde paylaştığı fotoğrafların Instagram benzeri kare grid'i.
 * Karta tıklayınca lightbox açılır (etkinliğe git linkiyle).
 */
export function ProfileWall({
  photos,
  isOwn,
}: {
  photos: GalleryPhoto[];
  isOwn?: boolean;
}) {
  const [idx, setIdx] = useState<number | null>(null);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Grid3x3 className="size-4 text-[var(--primary)]" /> Duvar
          {photos.length > 0 && (
            <span className="text-sm font-normal text-[var(--muted)]">{photos.length} fotoğraf</span>
          )}
        </h2>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)]/30 p-8 text-center">
          <div className="text-4xl mb-2">📷</div>
          <p className="text-sm text-[var(--muted)]">
            {isOwn
              ? "Henüz fotoğraf paylaşmadın. Katıldığın etkinliklerin sayfasından foto ekle, burada görünsün."
              : "Henüz fotoğraf paylaşılmamış."}
          </p>
          {isOwn && (
            <Link
              href="/etkinlikler"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-95"
            >
              <ImagePlus className="size-4" /> Etkinliklerde paylaş
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
          {photos.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => setIdx(i)}
              whileHover={{ scale: 0.985 }}
              className="group relative aspect-square overflow-hidden rounded-md sm:rounded-lg bg-[var(--muted-bg)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption || "Fotoğraf"}
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {p.caption && (
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[11px] text-white line-clamp-1 inline-flex items-center gap-1">
                    <MessageSquare className="size-3" /> {p.caption}
                  </span>
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      <PhotoLightbox
        open={idx !== null}
        photos={photos}
        index={idx ?? 0}
        onClose={() => setIdx(null)}
        onIndexChange={(n) => setIdx(n)}
      />
    </section>
  );
}
