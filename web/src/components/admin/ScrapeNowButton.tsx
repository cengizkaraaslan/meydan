"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface SourceInfo {
  source: string;
  label: string;
}

/** Tek bir kaynak için (canlı) çalışma durumu. */
interface SourceState {
  status: "running" | "ok" | "error";
  eventCount?: number;
  error?: string;
}

/** POST /api/v1/admin/scrapers — tek source yanıtı. */
interface SingleScrapeResult {
  results?: { source: string; success: boolean; itemsFound: number; error?: string | null }[];
  error?: string;
}

const CONCURRENCY = 4;

export function ScrapeNowButton({ email, sources }: { email: string; sources: SourceInfo[] }) {
  const [runningAll, setRunningAll] = useState(false);
  // Hangi source'lar şu an çalışıyor + bitmiş sonuçları.
  const [states, setStates] = useState<Record<string, SourceState>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  /** Tek bir kaynağı çalıştır; canlı durumu güncelle. Başarılıysa true döner. */
  async function runOne(source: string): Promise<boolean> {
    setStates((prev) => ({ ...prev, [source]: { status: "running" } }));
    try {
      const res = await fetch("/api/v1/admin/scrapers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data: SingleScrapeResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStates((prev) => ({
          ...prev,
          [source]: { status: "error", error: data.error ?? `HTTP ${res.status}` },
        }));
        return false;
      }
      const r = data.results?.[0];
      const success = r?.success ?? false;
      setStates((prev) => ({
        ...prev,
        [source]: success
          ? { status: "ok", eventCount: r?.itemsFound ?? 0 }
          : { status: "error", error: r?.error ?? "Bilinmeyen hata" },
      }));
      return success;
    } catch {
      setStates((prev) => ({
        ...prev,
        [source]: { status: "error", error: "İstek başarısız" },
      }));
      return false;
    }
  }

  async function runAll() {
    if (runningAll) return;
    setRunningAll(true);
    setError(null);
    setSummary(null);
    setStates({});

    const queue = sources.map((s) => s.source);
    let cursor = 0;
    let successCount = 0;

    // Eşzamanlılık sınırı CONCURRENCY ile worker havuzu.
    async function worker() {
      while (cursor < queue.length) {
        const source = queue[cursor++];
        const ok = await runOne(source);
        if (ok) successCount++;
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()),
      );
      setSummary(`${successCount}/${queue.length} bot başarılı`);
      // Etkinlik listelerini tazele (yeni veriler görünsün)
      startTransition(() => router.refresh());
    } catch {
      setError("Çalıştırma sırasında beklenmeyen bir hata oluştu");
    } finally {
      setRunningAll(false);
    }
  }

  // Tek bir satır için canlı sonuç listesi: çalışan + biten kaynaklar.
  const liveEntries = sources
    .map((s) => ({ ...s, state: states[s.source] }))
    .filter((e) => e.state);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-lg">🤖</span> Tüm botları şimdi çalıştır
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Her scraper&apos;ı ayrı ayrı tetikler ({CONCURRENCY}&apos;lü gruplar), sonuçları veritabanına yazar. (Otomatik: her gün 06:00)
          </p>
        </div>
        <motion.button
          type="button"
          onClick={runAll}
          disabled={runningAll}
          whileHover={{ scale: runningAll ? 1 : 1.04 }}
          whileTap={{ scale: runningAll ? 1 : 0.96 }}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2.5 text-sm font-semibold shadow-lg shadow-[var(--primary)]/30 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {runningAll ? (
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

        {summary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--success)]/10 text-[var(--success)] px-3 py-2.5 text-sm font-medium"
          >
            <CheckCircle2 className="size-4 shrink-0" /> {summary}
          </motion.div>
        )}

        {liveEntries.length > 0 && (
          <motion.div
            key="live"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 grid sm:grid-cols-2 gap-1.5 max-h-72 overflow-auto"
          >
            {liveEntries.map(({ source, label, state }) => (
              <div
                key={source}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs"
              >
                <span className="truncate font-medium">{label}</span>
                {state!.status === "running" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--primary)]" />
                ) : state!.status === "ok" ? (
                  <span className="shrink-0 text-[var(--muted)]">{state!.eventCount} ✓</span>
                ) : (
                  <span className="shrink-0 text-[var(--danger)]" title={state!.error}>
                    hata
                  </span>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
