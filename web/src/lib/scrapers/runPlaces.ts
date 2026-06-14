import "server-only";
import { MuzeScraper, type MuzeScraperOptions } from "./providers/MuzeScraper";
import { setPlacesForSource } from "./PlaceCache";
import { persistRun } from "./RunTracker";
import type { ScraperResult } from "./BaseScraper";

export interface PlacesRunSummary {
  source: string;
  success: boolean;
  placeCount: number;
  written: number;
  created: number;
  updated: number;
  durationMs: number;
  error?: string;
}

/**
 * Müze scraper'ını çalıştırıp Place tablosuna yazar ve ScraperRun'a rapor düşer.
 * Admin "Scrapers" sayfası MUZE_GOV satırını otomatik gösterir (itemsCreated = yeni müze).
 * MuzeScraper REGISTRY'ye KAYITLI DEĞİL (günlük event cron'unu bozmasın) → ayrı çalıştırılır.
 */
export async function runAndPersistPlaces(opts: MuzeScraperOptions = {}): Promise<PlacesRunSummary> {
  const scraper = new MuzeScraper();
  const result = await scraper.run(opts);

  let written = 0, created = 0, updated = 0;
  try {
    if (result.success && result.places.length > 0) {
      const r = await setPlacesForSource(result.source, result.places);
      written = r.written;
      created = r.created;
      updated = r.updated;
    }
  } catch (err) {
    console.warn("[runPlaces] yazım hatası:", err instanceof Error ? err.message : err);
  }

  // persistRun yalnız result.events.length okur → ScrapedPlace[]'i ScraperResult gibi geçiyoruz.
  const asResult = {
    source: result.source,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    events: result.places,
    success: result.success,
    errorMessage: result.errorMessage,
  } as unknown as ScraperResult;
  try {
    await persistRun(asResult, { created, updated });
  } catch {
    /* rapor yazımı scrape'i bozmasın */
  }

  return {
    source: result.source,
    success: result.success,
    placeCount: result.places.length,
    written,
    created,
    updated,
    durationMs: result.finishedAt.getTime() - result.startedAt.getTime(),
    error: result.errorMessage,
  };
}
