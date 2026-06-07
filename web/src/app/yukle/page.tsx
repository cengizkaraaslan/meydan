"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PhotoUpload } from "@/components/PhotoUpload";
import type { UploadFolder } from "@/lib/upload";

const FOLDERS: { value: UploadFolder; label: string }[] = [
  { value: "proposals", label: "Öneriler" },
  { value: "events", label: "Etkinlikler" },
  { value: "profile", label: "Profil" },
  { value: "comments", label: "Yorumlar" },
  { value: "messages", label: "Mesajlar" },
];

export default function UploadTestPage() {
  const [folder, setFolder] = useState<UploadFolder>("proposals");
  const [url, setUrl] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="size-4 rtl:rotate-180" /> Anasayfa
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight">📤 R2 Upload Test</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Cloudflare R2'ye foto yükle. Dev'de <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5">test/</code> klasörüne,
          production'da <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5">canli/</code> klasörüne yazar.
        </p>
      </header>

      <div className="mt-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-[var(--muted)] block mb-2">Hangi klasöre yüklensin?</label>
          <div className="flex gap-2 flex-wrap">
            {FOLDERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFolder(f.value)}
                className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                  folder === f.value
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                    : "border-[var(--border)] hover:bg-[var(--muted-bg)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <PhotoUpload folder={folder} value={url} onChange={(u, k) => { setUrl(u); setKey(k ?? null); }} />

        {key && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <Row label="Bucket key" value={key} />
            {url && url !== key && <Row label="Public URL" value={url} />}
            {url === key && (
              <p className="text-xs text-[var(--accent)]">
                ⚠ <code>R2_PUBLIC_URL</code> ayarlı değil — bucket'a public access verip Cloudflare'in verdiği <code>pub-xxxx.r2.dev</code> URL'sini env'e ekle.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 text-xs font-mono break-all">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Kopyalandı");
          }}
          aria-label="Kopyala"
          className="grid place-items-center rounded-lg size-8 hover:bg-[var(--muted-bg)]"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
