import "server-only";

export type ReportTarget = "comment" | "user" | "event";
export type ReportStatus = "open" | "dismissed" | "actioned";
export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "inappropriate"
  | "scam"
  | "other";

export interface Report {
  id: string;
  target: ReportTarget;
  targetId: string;
  targetExcerpt: string;
  targetContext?: string;
  reason: ReportReason;
  note: string;
  reporterEmail: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionAction?: "dismiss" | "hide" | "ban";
}

interface ReportStoreShape {
  reports: Map<string, Report>;
  rateLimits: Map<string, number[]>; // reporterEmail -> timestamps (ms)
}

const g = globalThis as unknown as { __reportsStore?: ReportStoreShape };
g.__reportsStore ??= { reports: new Map(), rateLimits: new Map() };
const store = g.__reportsStore;

function seedIfEmpty() {
  if (store.reports.size > 0) return;
  const now = Date.now();
  const seedList: Report[] = [
    {
      id: "rep-seed-1",
      target: "comment",
      targetId: "seed-rock-n-coke-2026-2",
      targetExcerpt:
        "Geçen sene de gitmiştim, ses çok iyiydi. Tavsiye ederim 🎶",
      targetContext: "rock-n-coke-2026",
      reason: "spam",
      note: "Sürekli aynı şeyi yazıyor, başka yerlerde de gördüm.",
      reporterEmail: "ahmet@example.com",
      status: "open",
      createdAt: new Date(now - 1000 * 60 * 35).toISOString(),
    },
    {
      id: "rep-seed-2",
      target: "user",
      targetId: "burak",
      targetExcerpt: "@burak",
      reason: "harassment",
      note: "Yorumlarda hakaret ediyor.",
      reporterEmail: "elif@example.com",
      status: "open",
      createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: "rep-seed-3",
      target: "event",
      targetId: "sahte-bilet-konseri-2026",
      targetExcerpt: "Sahte Bilet Konseri 2026 - %90 indirim!",
      reason: "scam",
      note: "Etkinlik şüpheli, bilet linkleri çalışmıyor.",
      reporterEmail: "zeynep@example.com",
      status: "open",
      createdAt: new Date(now - 1000 * 60 * 60 * 22).toISOString(),
    },
  ];
  for (const r of seedList) store.reports.set(r.id, r);
}

seedIfEmpty();

export function createReport(input: {
  target: ReportTarget;
  targetId: string;
  targetExcerpt: string;
  targetContext?: string;
  reason: ReportReason;
  note: string;
  reporterEmail: string;
}): Report {
  const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const report: Report = {
    id,
    target: input.target,
    targetId: input.targetId,
    targetExcerpt: input.targetExcerpt.slice(0, 200),
    targetContext: input.targetContext,
    reason: input.reason,
    note: input.note.slice(0, 500),
    reporterEmail: input.reporterEmail,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  store.reports.set(id, report);
  return report;
}

export function listReports(opts: { status?: ReportStatus } = {}): Report[] {
  const all = [...store.reports.values()];
  const filtered = opts.status ? all.filter((r) => r.status === opts.status) : all;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getReport(id: string): Report | null {
  return store.reports.get(id) ?? null;
}

export function updateReportStatus(
  id: string,
  status: ReportStatus,
  resolvedBy: string,
  resolutionAction?: "dismiss" | "hide" | "ban",
): Report | null {
  const r = store.reports.get(id);
  if (!r) return null;
  r.status = status;
  r.resolvedAt = new Date().toISOString();
  r.resolvedBy = resolvedBy;
  r.resolutionAction = resolutionAction;
  store.reports.set(id, r);
  return r;
}

export function getOpenCount(): number {
  let count = 0;
  for (const r of store.reports.values()) {
    if (r.status === "open") count++;
  }
  return count;
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(reporterEmail: string): boolean {
  const now = Date.now();
  const timestamps = store.rateLimits.get(reporterEmail) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    store.rateLimits.set(reporterEmail, recent);
    return false;
  }
  recent.push(now);
  store.rateLimits.set(reporterEmail, recent);
  return true;
}
