"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { UploadFolder } from "@/lib/upload";

interface PhotoUploadProps {
  folder: UploadFolder;
  value?: string | null;
  onChange: (url: string | null, key?: string | null) => void;
  maxSizeMb?: number;
  label?: string;
  className?: string;
}

export function PhotoUpload({
  folder,
  value,
  onChange,
  maxSizeMb = 5,
  label,
  className,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Sadece resim dosyaları yüklenebilir");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Dosya boyutu ${maxSizeMb} MB'tan büyük olamaz`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, filename: file.name, contentType: file.type }),
      });

      if (!presignRes.ok) {
        const json = await presignRes.json().catch(() => ({}));
        throw new Error(json.error ?? json.detail ?? `Presign hatası (${presignRes.status})`);
      }
      const { uploadUrl, key, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string;
        key: string;
        publicUrl: string;
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload hatası: ${xhr.status} ${xhr.statusText}`));
        };
        xhr.onerror = () => reject(new Error("Ağ hatası"));
        xhr.send(file);
      });

      onChange(publicUrl || key, key);
      toast.success("Foto yüklendi ✓");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Yükleme başarısız";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    return (
      <div className={className}>
        {label && <div className="text-xs font-medium text-[var(--muted)] mb-2">{label}</div>}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-2xl overflow-hidden border border-[var(--border)] aspect-video bg-[var(--muted-bg)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Yüklenen foto" className="w-full h-full object-cover" />
          <div className="absolute top-2 start-2 inline-flex items-center gap-1 rounded-full bg-[var(--success)]/90 text-white px-2 py-1 text-xs font-medium backdrop-blur">
            <CheckCircle2 className="size-3" /> Yüklendi
          </div>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            aria-label="Fotoğrafı kaldır"
            className="absolute top-2 end-2 grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur transition-colors"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && <div className="text-xs font-medium text-[var(--muted)] mb-2">{label}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group w-full aspect-video rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--muted-bg)]/40 transition-all flex flex-col items-center justify-center gap-3 disabled:cursor-not-allowed disabled:hover:border-[var(--border)]"
      >
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Upload className="size-8 text-[var(--primary)]" />
              </motion.div>
              <div className="w-40 h-1.5 bg-[var(--muted-bg)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--primary)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <span className="text-xs text-[var(--muted)] tabular-nums">%{progress} yükleniyor…</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted-bg)] text-[var(--muted)] group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)] transition-colors">
                <ImageIcon className="size-6" />
              </span>
              <span className="text-sm font-medium">Foto yükle</span>
              <span className="text-xs text-[var(--muted)]">JPG/PNG/WebP/GIF · maks {maxSizeMb} MB</span>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      {error && (
        <p className="mt-2 text-xs text-[var(--danger)] inline-flex items-center gap-1">
          <AlertCircle className="size-3" /> {error}
        </p>
      )}
    </div>
  );
}
