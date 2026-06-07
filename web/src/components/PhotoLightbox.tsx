"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/gallery-store";

interface PhotoLightboxProps {
  open: boolean;
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function PhotoLightbox({
  open,
  photos,
  index,
  onClose,
  onIndexChange,
}: PhotoLightboxProps) {
  const total = photos.length;
  const current = photos[index];

  const goPrev = useCallback(() => {
    if (total === 0) return;
    onIndexChange((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const goNext = useCallback(() => {
    if (total === 0) return;
    onIndexChange((index + 1) % total);
  }, [index, total, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/85 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Foto görüntüleyici"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute top-4 right-4 z-10 inline-flex items-center justify-center size-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="size-5" />
          </button>

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Önceki foto"
                className="absolute left-4 z-10 inline-flex items-center justify-center size-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Sonraki foto"
                className="absolute right-4 z-10 inline-flex items-center justify-center size-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-h-[75vh] aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-black">
              <Image
                src={current.url}
                alt={current.caption || "Etkinlik fotoğrafı"}
                fill
                sizes="(min-width: 1024px) 80vw, 100vw"
                className="object-contain"
                unoptimized
              />
            </div>

            <div className="mt-4 w-full rounded-2xl bg-white/5 backdrop-blur px-4 py-3 text-white">
              {current.caption && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-2">
                  {current.caption}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 text-xs text-white/70">
                <span className="font-medium text-white/90">{current.uploaderName}</span>
                <span>
                  {formatDate(current.createdAt)}
                  {total > 1 ? ` · ${index + 1} / ${total}` : ""}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
