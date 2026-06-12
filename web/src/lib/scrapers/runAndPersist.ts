import "server-only";
import { scraperRegistry } from "./ScraperRegistry";
import { recordRun, persistRun } from "./RunTracker";
import { setEventsForSource } from "./EventCache";
import type { ScraperResult } from "./BaseScraper";

/**
 * Cron (`/api/cron/scrape`) ve admin ("Tüm verileri çek") için ORTAK çalıştır+yaz mantığı.
 *
 * Neden ayrı helper: eski akış `runAll()` (tüm scraper'ları paralel) bitene kadar bekleyip
 * SONRA sonuçları TEK TEK ardışık yazıyordu (her kaynak: setEventsForSource + syncSystemPosts +
 * persistRun). ~74 kaynak × bu ağır iş ardışık → Vercel `maxDuration=60sn` aşılıp lambda kesiliyor;
 * yalnız dizinin başındaki birkaç (hızlı bilet) scraper yazılabiliyor, geri kalan ~69 belediye/üniv.
 * scraper'ı hiç kalıcılaşmıyordu.
 *
 * Yeni akış: fetch'lerin HEPSİ aynı anda ateşlenir (her scraper tek ~≤15sn fetch → toplam ~15sn),
 * çözüldükçe persist işi SINIRLI eşzamanlı bir havuzdan (DB'yi/pooler'ı boğmadan) anında yapılır.
 * Zaman çizelgesi ~15sn fetch + birkaç sn persist drenajına çöker (≈20-25sn) → 60sn'nin çok altı.
 */

export interface SourceRunSummary {
  source: string;
  success: boolean;
  eventCount: number;
  written: number;
  durationMs: number;
  error?: string;
}

/** Sınırlı eşzamanlı görev havuzu (harici bağımlılık yok). */
async function runPool<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

async function persistResult(r: ScraperResult): Promise<SourceRunSummary> {
  recordRun(r);
  let written = 0;
  try {
    written = r.success && r.events.length > 0 ? await setEventsForSource(r.source, r.events) : 0;
    await persistRun(r, { created: written });
  } catch (err) {
    // persist hatası tek kaynağı düşürsün, turu değil; yine de ScraperRun'a yazmayı dene.
    try {
      await persistRun(r, { created: written });
    } catch {
      /* yut */
    }
    console.warn(`[runAndPersist] ${r.source} persist hatası:`, err instanceof Error ? err.message : err);
  }
  return {
    source: String(r.source),
    success: r.success,
    eventCount: r.events.length,
    written,
    durationMs: r.finishedAt.getTime() - r.startedAt.getTime(),
    error: r.errorMessage,
  };
}

export interface RunAndPersistOptions {
  /** Persist (DB yazımı) eşzamanlılığı. Neon pooler'ı boğmamak için sınırlı. */
  concurrency?: number;
  /** Sharding: yalnız i % shards === shard olan scraper'ları çalıştır (round-robin, dengeli). */
  shard?: number;
  shards?: number;
}

/**
 * Tüm (ya da bir shard'ın) scraper'larını çalıştırır ve sonuçları Neon'a yazar.
 * Fetch'ler paralel; persist sınırlı havuzdan akar. Kaynak-bazlı özet döner.
 */
export async function runAndPersistAll(opts: RunAndPersistOptions = {}): Promise<SourceRunSummary[]> {
  const concurrency = opts.concurrency
    ?? (process.env.SCRAPE_CONCURRENCY ? Number(process.env.SCRAPE_CONCURRENCY) : 6);

  let scrapers = scraperRegistry.list();
  const shards = opts.shards && opts.shards > 1 ? Math.floor(opts.shards) : 1;
  if (shards > 1) {
    const shard = (((opts.shard ?? 0) % shards) + shards) % shards;
    scrapers = scrapers.filter((_, i) => i % shards === shard);
  }

  // 1) Tüm fetch'leri paralel ateşle (her scraper tek ~≤15sn fetch → toplam ~15sn).
  //    BaseScraper.run() asla throw etmez (hatayı yutup success:false döner) → reddetmez.
  const results = await Promise.all(scrapers.map((s) => s.run()));

  // 2) Persist'i sınırlı eşzamanlı havuzdan geçir (Neon pooler'ı boğmadan, ~birkaç sn).
  return runPool(
    results.map((r) => () => persistResult(r)),
    Math.max(1, concurrency),
  );
}

/**
 * Fan-out: tek lambda'da 74 kaynağı çalıştırmak Vercel `maxDuration=60sn`'yi aşıyor
 * (persist + syncSystemPosts ağır). Çözüm: işi N parçaya böl, her parçayı AYRI bir
 * `/api/cron/scrape?shard=i&shards=N` çağrısına (kendi 60sn bütçeli ayrı lambda) paralel
 * dağıt. Orchestrator yalnız paralel sonuçları bekler → toplam ~tek shard süresi (<60sn).
 *
 * @param origin  İstek origin'i (kendi deployment'ına çağrı → new URL(req.url).origin)
 * @param shards  Parça sayısı (env SCRAPE_SHARDS, vars. 6)
 * @param secret  CRON_SECRET — leaf cron çağrılarını yetkilendirmek için (runtime'da mevcut)
 */
export async function fanOutScrape(
  origin: string,
  shards: number,
  secret?: string,
): Promise<SourceRunSummary[]> {
  const n = Math.max(1, Math.floor(shards));
  const tasks = Array.from({ length: n }, (_, i) =>
    fetch(`${origin}/api/cron/scrape?shard=${i}&shards=${n}`, {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`shard ${i} HTTP ${r.status}`);
        const j = (await r.json()) as { results?: Array<Record<string, unknown>> };
        // Leaf cron yanıtını SourceRunSummary'ye normalize et.
        return (j.results ?? []).map((x) => ({
          source: String(x.source),
          success: Boolean(x.success),
          eventCount: Number(x.event_count ?? 0),
          written: Number(x.written ?? 0),
          durationMs: Number(x.duration_ms ?? 0),
          error: (x.error as string) ?? undefined,
        })) as SourceRunSummary[];
      })
      .catch((err) => {
        console.warn(`[fanOutScrape] shard ${i} hata:`, err instanceof Error ? err.message : err);
        return [] as SourceRunSummary[];
      }),
  );
  const perShard = await Promise.all(tasks);
  return perShard.flat();
}
