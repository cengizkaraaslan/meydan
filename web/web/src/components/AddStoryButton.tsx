"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ImagePlus, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { addStoryAction } from "@/lib/stories-actions";
import { playSuccessDing } from "@/lib/sounds";

type UploadStep = "idle" | "presign" | "upload" | "save" | "done";
const STEP_LABELS: Record<UploadStep, string> = {
  idle: "",
  presign: "Hazırlanıyor",
  upload: "Yükleniyor",
  save: "Kaydediliyor",
  done: "Tamamlandı",
};

function StepDot({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <span
        className={`size-2 rounded-full transition-colors ${
          done
            ? "bg-[var(--success)]"
            : active
              ? "bg-[var(--primary)]"
              : "bg-[var(--border)]"
        }`}
      />
      <span className={active ? "text-[var(--foreground)]" : ""}>{label}</span>
    </div>
  );
}

interface AddStoryButtonProps {
  /** Strip içindeki etkinlik filtresi — açıkken eventSlug otomatik bağlanır */
  forcedEventSlug?: string;
  forcedEventTitle?: string;
  onAdded?: () => void;
  /** Etiket görünmesin (yalnız + iconu) */
  variant?: "ring" | "compact";
  label?: string;
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const MAX_PICK_BYTES = 20 * 1024 * 1024; // sıkıştırmadan ÖNCE kabul edilen ham boyut
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // sıkıştırma SONRASI üst sınır (Vercel ~4.5MB body limitinin altı)
const MAX_CAPTION_LEN = 200;

/**
 * Fotoğrafı client'ta küçültüp JPEG'e sıkıştırır (413 Payload Too Large önler).
 * En uzun kenar 1280px'e indirilir, kalite 0.82. GIF/sıkıştırılamayan dosyalar
 * ve decode edilemeyenler (ör. bazı tarayıcılarda HEIC) olduğu gibi döner.
 */
async function compressImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1280;
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return file;
    // Sıkıştırma gerçekten küçülttüyse onu kullan (küçük/zaten optimize dosyada orijinali bırak)
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  uploadMethod?: "PUT" | "POST";
}

export function AddStoryButton({
  forcedEventSlug,
  forcedEventTitle,
  onAdded,
  variant = "ring",
  label,
}: AddStoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Object URL preview cleanup
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function resetState() {
    setFile(null);
    setCaption("");
    setStep("idle");
    setProgress(0);
  }

  function openModal() {
    resetState();
    setOpen(true);
  }
  function closeModal() {
    if (uploading) return;
    setOpen(false);
    resetState();
  }

  function onPickFile(f: File | null) {
    if (!f) return;
    const okType =
      ALLOWED_TYPES.has(f.type) ||
      /\.(heic|heif)$/i.test(f.name);
    if (!okType) {
      toast.error("Sadece JPEG, PNG, WEBP veya HEIC yükleyebilirsin");
      return;
    }
    if (f.size > MAX_PICK_BYTES) {
      toast.error("Dosya en fazla 20 MB olabilir");
      return;
    }
    setFile(f);
  }

  /**
   * fetch ile R2'ye upload + progress simulasyonu.
   *
   * XHR ile gerçek progress alınabilir ama R2 presigned URL'leri
   * setRequestHeader("Content-Type") çağrısında CORS preflight (OPTIONS)
   * tetikliyor ve R2 OPTIONS'a izin vermiyor → "Network error".
   * Bu yüzden fetch + dosya boyutuna göre tahmini progress gösteriyoruz.
   */
  async function uploadWithProgress(
    url: string,
    method: "PUT" | "POST",
    contentType: string,
    body: Blob,
  ): Promise<void> {
    const sizeKB = body.size / 1024;
    const estimatedSeconds = Math.max(1, Math.min(15, sizeKB / 200));
    const stepMs = 100;
    const stepPct = 95 / ((estimatedSeconds * 1000) / stepMs);
    let current = 0;
    const interval = setInterval(() => {
      current = Math.min(95, current + stepPct);
      setProgress(Math.round(current));
    }, stepMs);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": contentType },
        body,
      });
      if (!res.ok) {
        throw new Error(`Foto yüklenemedi (${res.status})`);
      }
      setProgress(100);
    } finally {
      clearInterval(interval);
    }
  }

  /** Eski XHR yöntemi — şu an kullanılmıyor (CORS sorun nedeniyle) */
  function xhrUpload(url: string, method: "PUT" | "POST", contentType: string, body: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(body);
    });
  }

  async function handleUpload(e?: React.FormEvent) {
    e?.preventDefault();
    if (!file) {
      toast.error("Önce bir foto seç");
      return;
    }
    if (caption.length > MAX_CAPTION_LEN) {
      toast.error(`Açıklama en fazla ${MAX_CAPTION_LEN} karakter olabilir`);
      return;
    }
    setUploading(true);
    setProgress(0);
    setStep("upload");

    // 413 önlemek için client'ta küçült/sıkıştır (Vercel ~4.5MB body limiti).
    let upload: Blob = file;
    try {
      upload = await compressImage(file);
    } catch {
      upload = file;
    }
    if (upload.size > MAX_UPLOAD_BYTES) {
      setUploading(false);
      setStep("idle");
      setProgress(0);
      toast.error("Foto çok büyük. Daha küçük/düşük çözünürlüklü bir tane seç.");
      return;
    }

    // Server-side upload — client R2'ye doğrudan PUT atmıyor.
    // CORS problemini ortadan kaldırır ("Failed to fetch" bu yüzdendi).
    const form = new FormData();
    const uploadName = upload.type === "image/jpeg" ? "story.jpg" : file.name || "story";
    form.append("file", upload, uploadName);
    if (caption.trim()) form.append("caption", caption.trim());
    if (forcedEventSlug) form.append("eventSlug", forcedEventSlug);

    // Progress simülasyonu — fetch boyunca artan animasyon
    const sizeKB = file.size / 1024;
    const estimatedSeconds = Math.max(1.5, Math.min(20, sizeKB / 150));
    const stepMs = 100;
    const stepPct = 90 / ((estimatedSeconds * 1000) / stepMs);
    let current = 0;
    const interval = setInterval(() => {
      current = Math.min(90, current + stepPct);
      setProgress(Math.round(current));
    }, stepMs);

    try {
      let res: Response;
      try {
        res = await fetch("/api/stories/upload", {
          method: "POST",
          body: form,
        });
      } catch {
        throw new Error("Sunucuya bağlanılamadı. İnternetini kontrol et.");
      }
      clearInterval(interval);

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        if (res.status === 401) throw new Error("Önce giriş yap.");
        if (res.status === 503)
          throw new Error("Foto sunucusu (R2) yapılandırılmamış. Yöneticiye bildir.");
        throw new Error(data?.error ?? `Yükleme başarısız (${res.status})`);
      }

      setProgress(100);
      setStep("done");
      playSuccessDing();
      toast.success("Hikayen 24 saat boyunca yayında ✨");
      setTimeout(() => {
        setOpen(false);
        resetState();
        onAdded?.();
      }, 600);
    } catch (err) {
      clearInterval(interval);
      toast.error(err instanceof Error ? err.message : "Yükleme başarısız");
      setStep("idle");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {variant === "ring" ? (
        <button
          type="button"
          onClick={openModal}
          className="group flex flex-col items-center gap-1.5 shrink-0 focus:outline-none"
          aria-label="Story ekle"
        >
          <span className="size-16 sm:size-[72px] rounded-full p-[3px] grid place-items-center bg-[var(--border)] transition-transform group-hover:scale-105">
            <span className="size-[58px] sm:size-[64px] rounded-full bg-[var(--card)] grid place-items-center">
              <span className="size-[54px] sm:size-[60px] rounded-full bg-[var(--primary)]/10 text-[var(--primary)] grid place-items-center group-hover:bg-[var(--primary)]/20 transition-colors">
                <Plus className="size-6" />
              </span>
            </span>
          </span>
          <span className="text-[11px] leading-tight text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
            {label ?? "Story ekle"}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <ImagePlus className="size-3.5" />
          {label ?? "Sen de paylaş"}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] grid place-items-end sm:place-items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={closeModal}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Story ekle"
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
                  <div>
                    <h4 className="font-semibold leading-tight">Story paylaş</h4>
                    <p className="text-xs text-[var(--muted)]">24 saat sonra otomatik kaybolur</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={uploading}
                  aria-label="Kapat"
                  className="inline-flex items-center justify-center size-9 rounded-full hover:bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                >
                  <X className="size-5" />
                </button>
              </div>

              {forcedEventSlug && forcedEventTitle && (
                <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]/50 px-3 py-2 text-xs text-[var(--muted)]">
                  Etkinlik:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {forcedEventTitle}
                  </span>
                </div>
              )}

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Foto
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                    capture="environment"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />

                  {/* Preview + uploader */}
                  {file && previewUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-[var(--border)] aspect-[3/4] max-h-72 mx-auto bg-black/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 flex items-center justify-between text-xs text-white">
                        <span className="truncate max-w-[60%]" title={file.name}>
                          {file.name}
                        </span>
                        <span className="opacity-80">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      {!uploading && (
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          aria-label="Fotoyu kaldır"
                          className="absolute top-2 end-2 grid place-items-center size-8 rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)]/40 px-3 py-10 text-sm hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors disabled:opacity-50"
                    >
                      <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
                        <Upload className="size-6" />
                        <span>Galeriden seç veya kameradan çek</span>
                        <span className="text-[10px]">JPEG / PNG / WEBP · max 5 MB</span>
                      </div>
                    </button>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="story-caption"
                    className="block text-xs font-medium text-[var(--muted)] mb-1.5"
                  >
                    Açıklama (opsiyonel)
                  </label>
                  <textarea
                    id="story-caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LEN))}
                    disabled={uploading}
                    rows={2}
                    placeholder="Bir cümle ekle..."
                    className="w-full resize-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors disabled:opacity-60"
                  />
                  <div className="mt-1 text-right text-xs text-[var(--muted)]">
                    {caption.length}/{MAX_CAPTION_LEN}
                  </div>
                </div>

                {/* Progress bar — sadece upload sırasında */}
                <AnimatePresence>
                  {uploading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl bg-[var(--muted-bg)] p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            {step === "done" ? (
                              <Check className="size-3.5 text-[var(--success)]" />
                            ) : (
                              <Loader2 className="size-3.5 animate-spin text-[var(--primary)]" />
                            )}
                            {STEP_LABELS[step]}
                          </span>
                          <span className="tabular-nums text-[var(--muted)]">
                            {step === "upload"
                              ? `%${progress}`
                              : step === "save"
                                ? "%99"
                                : step === "done"
                                  ? "%100"
                                  : "%0"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--background)] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
                            initial={{ width: 0 }}
                            animate={{
                              width:
                                step === "presign"
                                  ? "10%"
                                  : step === "upload"
                                    ? `${10 + progress * 0.8}%`
                                    : step === "save"
                                      ? "95%"
                                      : step === "done"
                                        ? "100%"
                                        : "0%",
                            }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                          />
                        </div>
                        {/* Adım göstergesi (3 nokta) */}
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mt-1">
                          <StepDot label="Hazırla" active={step !== "idle"} done={step !== "presign" && step !== "idle"} />
                          <StepDot label="Yükle" active={["upload","save","done"].includes(step)} done={["save","done"].includes(step)} />
                          <StepDot label="Yayınla" active={["save","done"].includes(step)} done={step === "done"} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={uploading}
                    className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-50"
                  >
                    Vazgeç
                  </button>
                  <motion.button
                    type="submit"
                    disabled={uploading || !file}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 disabled:pointer-events-none glow-primary"
                  >
                    {step === "done" ? (
                      <>
                        <Check className="size-4" />
                        Yayında!
                      </>
                    ) : uploading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {STEP_LABELS[step]}
                      </>
                    ) : (
                      <>
                        <ImagePlus className="size-4" />
                        Paylaş
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
