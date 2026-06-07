"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface ScrapeResult {
  scraper_count: number;
  success_count: number;
  total_events: number;
  total_written: number;
  results: { source: string; success: boolean; event_count: number; error?: string }[];
}

export function ScrapeNowButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/scrape", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bir hata oluştu");
      } else {
        setResult(data);
        // Etkinlik listelerini tazele (yeni veriler görünsün)
        startTransition(() => router.refresh());
      }
    } catch {
      setError("İstek başarısız (zaman aşımı olabilir, biraz sonra tekrar dene)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-lg">🤖</span> Tüm botları şimdi çalıştır
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Tüm scraper&apos;ları tetikler, sonuçları veritabanına yazar. (Otomatik: her gün 06:00)
          </p>
        </div>
        <motion.button
          type="button"
          onClick={run}
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.04 }}
          whileTap={{ scale: loading ? 1 : 0.96 }}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2.5 text-sm font-semibold shadow-lg shadow-[var(--primary)]/30 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Çekiliyor…
            </>
          ) : (
            <>
              <Play className="size-4" /> Tüm verileri çek
            </>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--danger)]/10 text-[var(--danger)] px-3 py-2.5 text-sm"
          >
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="flex items-center gap-2 rounded-xl bg-[var(--success)]/10 text-[var(--success)] px-3 py-2.5 text-sm font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              {result.success_count}/{result.scraper_count} bot çalıştı · {result.total_events} etkinlik bulundu · {result.total_written} kayıt yazıldı
            </div>
            {/* Kaynak başına en çok çekenler */}
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-auto">
              {result.results
                .filter((r) => r.event_count > 0 || !r.success)
                .map((r) => (
                  <div
                    key={r.source}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">{r.source}</span>
                    {r.success ? (
                      <span className="text-[var(--muted)]">{r.event_count}</span>
                    ) : (
                      <span className="text-[var(--danger)]" title={r.error}>hata</span>
                    )}
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
