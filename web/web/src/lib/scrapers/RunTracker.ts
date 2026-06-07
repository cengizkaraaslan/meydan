import "server-only";
import type { EventSource } from "../types";
import type { ScraperResult } from "./BaseScraper";

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
