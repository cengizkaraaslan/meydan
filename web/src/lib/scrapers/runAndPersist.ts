import "server-only";
import { scraperRegistry } from "./ScraperRegistry";
import { recordRun, persistRun } from "./RunTracker";
import { setEventsForSource } from "./EventCache";
import type { BaseScraper, ScraperResult } from "./BaseScraper";

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

/**
 * Sınırlı eşzamanlı görev havuzu. deadlineTs verilirse o ana kadar YENİ görev başlatmaz
 * (çalışanlar biter) → tüm tur mutlak bir süre bütçesinde kalır.
 */
async function runPool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  deadlineTs?: number,
): Promise<T[]> {
  const results: T[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      if (deadlineTs && Date.now() >= deadlineTs) return; // bütçe doldu → yeni başlatma
      const i = next++;
      if (i >= tasks.length) return;
      results.push(await tasks[i]());
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
  /** Persist (DB yazımı) eşzamanlılığı. */
  concurrency?: number;
  /** Bu invocation için mutlak süre bütçesi (ms). Vercel maxDuration=60sn altında kalmalı. */
  budgetMs?: number;
}

/**
 * Scraper'ları çalıştırıp sonuçları Neon'a yazar — Vercel Hobby (tek vCPU + 60sn) için tasarlanmış.
 *
 * GERÇEKLER (ölçümle): 109 scraper var, sıralı toplam ~640sn; tek 60sn'lik lambda ancak ~55-63
 * kaynağı yetiştirir (chealio parse CPU-bound, eşzamanlılık ~10'da doyuyor). HTTP fan-out ve
 * after() self-chaining Hobby'de güvenilmez (eşzamanlı fonksiyon limiti / lingering lambda).
 *
 * ÇÖZÜM: tek invocation + MUTLAK SÜRE BÜTÇESİ (budgetMs, ~52sn) → bütçe dolunca yeni kaynak
 * başlatılmaz, tur ~bütçede biter ve 200 döner (asla 504 yok). Her kaynak bittiği anda yazılır
 * (kısmi tur da kalıcı). GÜNLÜK ROTASYON: kaynak listesi her gün kaydırılır → öncelik sırası
 * döner → tüm 109 kaynak ~2 günde taranır (önemli/hızlı biletçiler zaten her gün yetişir).
 */
export async function runAndPersistAll(opts: RunAndPersistOptions = {}): Promise<SourceRunSummary[]> {
  const concurrency = opts.concurrency
    ?? (process.env.SCRAPE_CONCURRENCY ? Number(process.env.SCRAPE_CONCURRENCY) : 10);
  // 44sn: yeni kaynak başlatmayı 44sn'de kes → çalışanların persist kuyruğu (büyük kaynakların
  // DB yazımı) da 60sn'den ÖNCE bitsin (52sn'de persist taşıp 504 oluyordu).
  const budgetMs = opts.budgetMs
    ?? (process.env.SCRAPE_BUDGET_MS ? Number(process.env.SCRAPE_BUDGET_MS) : 44_000);
  const deadlineTs = Date.now() + budgetMs;

  // Günlük rotasyon: listeyi gün-indeksine göre kaydır (her gün farklı kaynaklar öne gelir).
  const scrapers = scraperRegistry.list();
  const day = Math.floor(Date.now() / 86_400_000);
  const offset = scrapers.length > 0 ? (day * 55) % scrapers.length : 0;
  const rotated = [...scrapers.slice(offset), ...scrapers.slice(0, offset)];

  // Her görev = run()+persist; fetch & persist kaynaklar arası örtüşür. run() asla throw etmez.
  // Her run() KALAN bütçeyle yarışır → hiçbir kaynak mutlak deadline'ı aşamaz (lambda 60sn'de ölmez).
  return runPool(
    rotated.map((s) => async () => persistResult(await runCapped(s, deadlineTs))),
    Math.max(1, concurrency),
    deadlineTs,
  );
}

/** s.run()'ı KALAN bütçeyle (deadlineTs) yarıştırır; süre dolarsa başarısız ScraperResult döner. */
function runCapped(s: BaseScraper, deadlineTs: number): Promise<ScraperResult> {
  const startedAt = new Date();
  const capMs = Math.max(1000, deadlineTs - Date.now());
  let timer: ReturnType<typeof setTimeout>;
  const capped = new Promise<ScraperResult>((resolve) => {
    timer = setTimeout(
      () => resolve({
        source: s.source,
        startedAt,
        finishedAt: new Date(),
        events: [],
        success: false,
        errorMessage: "tur süre bütçesi doldu (bu kaynak sonraki turda)",
      }),
      capMs,
    );
  });
  return Promise.race([s.run().then((r) => { clearTimeout(timer); return r; }), capped]);
}
