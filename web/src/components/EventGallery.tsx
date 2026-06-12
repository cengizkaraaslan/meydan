"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ImagePlus, LogIn, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { addPhotoAction, removePhotoAction } from "@/lib/gallery-actions";
import type { GalleryPhoto } from "@/lib/gallery-store";
import { PhotoLightbox } from "./PhotoLightbox";

interface EventGalleryProps {
  slug: string;
  initialPhotos: GalleryPhoto[];
  isLoggedIn: boolean;
  hasRsvp: boolean;
  userEmail: string | null;
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_CAPTION_LEN = 280;

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn?: number;
  uploadMethod?: "PUT" | "POST";
}

export function EventGallery({
  slug,
  initialPhotos,
  isLoggedIn,
  hasRsvp,
  userEmail,
}: EventGalleryProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  // Arka planda yüklenen (optimistic önizleme) fotoların geçici id'leri.
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function openModal() {
    setFile(null);
    setCaption("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setFile(null);
    setCaption("");
  }

  function onPickFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(f.type)) {
      toast.error("Sadece JPEG, PNG, WEBP veya GIF yükleyebilirsin");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error("Dosya en fazla 8 MB olabilir");
      return;
    }
    setFile(f);
  }

  function handleUpload(e?: React.FormEvent) {
    e?.preventDefault();
    if (!file) {
      toast.error("Önce bir foto seç");
      return;
    }
    if (caption.length > MAX_CAPTION_LEN) {
      toast.error(`Açıklama en fazla ${MAX_CAPTION_LEN} karakter olabilir`);
      return;
    }

    // Optimistic: yerel önizlemeyi (blob URL) grid'e anında koy ve modalı kapat;
    // presign → R2 → kayıt zinciri arkada sürer. Bitince gerçek foto ile değiştir,
    // hata olursa placeholder'ı kaldır.
    const theFile = file;
    const theCaption = caption;
    const tempId = `tmp-${Date.now()}`;
    const previewUrl = URL.createObjectURL(theFile);
    const placeholder: GalleryPhoto = {
      id: tempId,
      eventSlug: slug,
      uploaderEmail: userEmail ?? "",
      uploaderName: userEmail?.split("@")[0] ?? "Sen",
      url: previewUrl,
      caption: theCaption,
      createdAt: new Date().toISOString(),
      reportCount: 0,
    };
    setPhotos((prev) => [placeholder, ...prev]);
    setUploadingIds((prev) => new Set(prev).add(tempId));
    closeModal();

    void (async () => {
      try {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: theFile.name,
            contentType: theFile.type,
            folder: "events",
          }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err?.error ?? "Yükleme adresi alınamadı");
        }
        const presign: PresignResponse = await presignRes.json();

        const method = presign.uploadMethod ?? "PUT";
        const putRes = await fetch(presign.uploadUrl, {
          method,
          headers: { "Content-Type": theFile.type },
          body: theFile,
        });
        if (!putRes.ok) throw new Error("Foto R2'ye yüklenemedi");

        const actionRes = await addPhotoAction(slug, presign.publicUrl, theCaption);
        if (!actionRes.ok || !actionRes.photo) {
          throw new Error(actionRes.error ?? "Foto kaydedilemedi");
        }
        setPhotos((prev) => prev.map((p) => (p.id === tempId ? actionRes.photo! : p)));
        toast.success("Anın yayınlandı 📸");
      } catch (err) {
        setPhotos((prev) => prev.filter((p) => p.id !== tempId));
        toast.error(err instanceof Error ? err.message : "Yükleme başarısız");
      } finally {
        setUploadingIds((prev) => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });
        URL.revokeObjectURL(previewUrl);
      }
    })();
  }

  function handleRemove(photo: GalleryPhoto) {
    if (!userEmail || photo.uploaderEmail !== userEmail) return;
    if (!window.confirm("Bu fotoyu silmek istediğine emin misin?")) return;
    startTransition(async () => {
      const prev = photos;
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      const res = await removePhotoAction(slug, photo.id);
      if (!res.ok) {
        toast.error(res.error ?? "Silinemedi");
        setPhotos(prev);
        return;
      }
      toast.success("Foto silindi");
    });
  }

  function openLightbox(idx: number) {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Camera className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold leading-tight inline-flex items-center gap-1.5">
              <span aria-hidden>📸</span> Anılar
              <span className="text-xs font-normal text-[var(--muted)]">
                ({photos.length})
              </span>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Etkinlikten kareler
            </p>
          </div>
        </div>

        {isLoggedIn && hasRsvp && (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-xs font-semibold hover:opacity-95 transition-opacity glow-primary shrink-0"
          >
            <ImagePlus className="size-3.5" />
            Foto yükle
          </button>
        )}
      </header>

      {!isLoggedIn && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)] px-4 py-3">
          <div className="flex-1 text-sm text-[var(--muted)]">
            Foto yüklemek için <span className="font-medium text-[var(--foreground)]">giriş yapmalısın</span>.
          </div>
          <Link
            href="/giris"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 text-sm font-semibold hover:opacity-95 transition-opacity"
          >
            <LogIn className="size-3.5" />
            Giriş yap
          </Link>
        </div>
      )}

      {isLoggedIn && !hasRsvp && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)] px-4 py-3 opacity-90">
          <ImagePlus className="size-4 text-[var(--muted)] shrink-0" />
          <div className="text-sm text-[var(--muted)]">
            Foto yüklemek için önce{" "}
            <span className="font-medium text-[var(--foreground)]">katılıyorum</span>{" "}
            de.
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)]/40">
          <div className="text-4xl mb-2" aria-hidden>📷</div>
          <p className="text-sm font-medium">Henüz anı paylaşılmadı</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            Etkinliğe katılıyor musun? İlk fotoyu sen ekle!
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {photos.map((photo, idx) => {
            const isMine = !!userEmail && photo.uploaderEmail === userEmail;
            const isUploading = uploadingIds.has(photo.id);
            return (
              <li
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-xl bg-[var(--muted-bg)]"
              >
                <button
                  type="button"
                  onClick={() => openLightbox(idx)}
                  className="absolute inset-0 w-full h-full"
                  aria-label={photo.caption || "Fotoyu büyüt"}
                >
                  <Image
                    src={photo.url}
                    alt={photo.caption || `${photo.uploaderName} tarafından paylaşıldı`}
                    fill
                    sizes="(min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                  {photo.caption && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2">
                      {photo.caption}
                    </span>
                  )}
                </button>
                {isMine && !isUploading && (
                  <button
                    type="button"
                    onClick={() => handleRemove(photo)}
                    disabled={pending}
                    aria-label="Fotoyu sil"
                    className="absolute top-2 right-2 inline-flex items-center justify-center size-8 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 hover:bg-[var(--danger)] transition-all disabled:pointer-events-none"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
                {isUploading && (
                  <span className="absolute inset-0 grid place-items-center bg-black/35 pointer-events-none">
                    <span className="size-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <PhotoLightbox
        open={lightboxOpen}
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
            onClick={closeModal}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Foto yükle"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <ImagePlus className="size-5" />
                  </span>
                  <h4 className="font-semibold">Anını paylaş</h4>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Kapat"
                  className="inline-flex items-center justify-center size-9 rounded-full hover:bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Foto
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)]/40 px-3 py-6 text-sm hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors disabled:opacity-50"
                  >
                    {file ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">{file.name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type.split("/")[1]?.toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-[var(--muted)]">
                        <Upload className="size-5" />
                        <span>Dosya seç (JPEG/PNG/WEBP/GIF, max 8 MB)</span>
                      </div>
                    )}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="gallery-caption"
                    className="block text-xs font-medium text-[var(--muted)] mb-1.5"
                  >
                    Açıklama (opsiyonel)
                  </label>
                  <textarea
                    id="gallery-caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))}
                    rows={3}
                    placeholder="Bu kareyi bir cümleyle anlat..."
                    className="w-full resize-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
                  />
                  <div className="mt-1 text-right text-xs text-[var(--muted)]">
                    {caption.length}/{MAX_CAPTION_LEN}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={!file}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 disabled:pointer-events-none glow-primary"
                  >
                    Yükle
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
