import "server-only";
import type { EventSource } from "../types";
import type { ScraperResult } from "./BaseScraper";
import { db, isDbConfigured } from "@/lib/db";

export interface RunRecord {
  source: EventSource;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  success: boolean;
  eventCount: number;
  errorMessage?: string;
}

const HISTORY_LIMIT = 50;
const RUNS = new Map<EventSource, RunRecord[]>();

export function recordRun(result: ScraperResult): RunRecord {
  const record: RunRecord = {
    source: result.source,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.finishedAt.getTime() - result.startedAt.getTime(),
    success: result.success,
    eventCount: result.events.length,
    errorMessage: result.errorMessage,
  };
  const arr = RUNS.get(result.source) ?? [];
  arr.unshift(record);
  if (arr.length > HISTORY_LIMIT) arr.length = HISTORY_LIMIT;
  RUNS.set(result.source, arr);
  return record;
}

export function getRunHistory(source: EventSource): RunRecord[] {
  return RUNS.get(source) ?? [];
}

export function getLatestRun(source: EventSource): RunRecord | null {
  return RUNS.get(source)?.[0] ?? null;
}

export function getRecentRuns(limit = 20): RunRecord[] {
  const all: RunRecord[] = [];
  for (const runs of RUNS.values()) all.push(...runs);
  return all.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, limit);
}

export function getSummary(): {
  totalRuns: number;
  failedRuns: number;
  lastRunAt: Date | null;
  totalEvents: number;
} {
  let totalRuns = 0, failedRuns = 0, totalEvents = 0;
  let lastRunAt: Date | null = null;
  for (const runs of RUNS.values()) {
    for (const r of runs) {
      totalRuns++;
      if (!r.success) failedRuns++;
      totalEvents += r.eventCount;
      if (!lastRunAt || r.startedAt > lastRunAt) lastRunAt = r.startedAt;
    }
  }
  return { totalRuns, failedRuns, lastRunAt, totalEvents };
}

// ---------------------------------------------------------------------------
// Kalıcı (DB) katmanı — ScraperRun tablosuna yazar/okur. Vercel'de her cron ayrı
// lambda olduğu için in-memory Map kaybolur; bu yüzden admin sayfası DB'den okur.
// isDbConfigured false ise hepsi sessizce boş/uygun default döner.
// ---------------------------------------------------------------------------

export interface PersistedRun {
  source: EventSource;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number;
  success: boolean;
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  errorMessage: string | null;
}

/** Scrape sonucunu kalıcı olarak ScraperRun tablosuna yazar (hata scrape'i bozmaz). */
export async function persistRun(
  result: ScraperResult,
  counts?: { created?: number; updated?: number },
): Promise<void> {
  if (!isDbConfigured) return;
  try {
    await db.scraperRun.create({
      data: {
        // Prisma EventSource enum'una uyumlu olsun diye String() ile geçiyoruz
        // (EventCache.setEventsForSource ile aynı kalıp).
        source: String(result.source) as never,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        itemsFound: result.events.length,
        itemsCreated: counts?.created ?? 0,
        itemsUpdated: counts?.updated ?? 0,
        success: result.success,
        errorMessage: result.errorMessage ?? null,
      },
    });
  } catch (err) {
    console.warn("[RunTracker] persistRun başarısız:", err);
  }
}

type ScraperRunRow = {
  source: string;
  startedAt: Date;
  finishedAt: Date | null;
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  success: boolean;
  errorMessage: string | null;
};

function toPersistedRun(row: ScraperRunRow): PersistedRun {
  return {
    source: row.source as EventSource,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.finishedAt ? row.finishedAt.getTime() - row.startedAt.getTime() : 0,
    success: row.success,
    itemsFound: row.itemsFound,
    itemsCreated: row.itemsCreated,
    itemsUpdated: row.itemsUpdated,
    errorMessage: row.errorMessage,
  };
}

/** En yeni N çalışmayı DB'den döner (startedAt desc). */
export async function getRecentRunsFromDb(limit = 100): Promise<PersistedRun[]> {
  if (!isDbConfigured) return [];
  try {
    const rows = await db.scraperRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return rows.map(toPersistedRun);
  } catch (err) {
    console.warn("[RunTracker] getRecentRunsFromDb başarısız:", err);
    return [];
  }
}

/** Her kaynak için en yeni çalışmayı döner (source -> PersistedRun). */
export async function getLatestRunPerSourceFromDb(): Promise<Map<string, PersistedRun>> {
  const map = new Map<string, PersistedRun>();
  if (!isDbConfigured) return map;
  try {
    // Son N kaydı çek, ilk gördüğümüz (en yeni) source'u tut.
    const rows = await db.scraperRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 500,
    });
    for (const row of rows) {
      if (!map.has(row.source)) map.set(row.source, toPersistedRun(row));
    }
    return map;
  } catch (err) {
    console.warn("[RunTracker] getLatestRunPerSourceFromDb başarısız:", err);
    return map;
  }
}

/** Son N saatteki özet (varsayılan 48 saat). */
export async function getDbSummary(sinceHours = 48): Promise<{
  totalRuns: number;
  failedRuns: number;
  lastRunAt: Date | null;
  totalEvents: number;
}> {
  const empty = { totalRuns: 0, failedRuns: 0, lastRunAt: null as Date | null, totalEvents: 0 };
  if (!isDbConfigured) return empty;
  try {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const rows = await db.scraperRun.findMany({
      where: { startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
    });
    let failedRuns = 0;
    let totalEvents = 0;
    for (const r of rows) {
      if (!r.success) failedRuns++;
      totalEvents += r.itemsFound;
    }
    return {
      totalRuns: rows.length,
      failedRuns,
      lastRunAt: rows[0]?.startedAt ?? null,
      totalEvents,
    };
  } catch (err) {
    console.warn("[RunTracker] getDbSummary başarısız:", err);
    return empty;
  }
}
