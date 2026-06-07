import { scraperRegistry } from "@/lib/scrapers/ScraperRegistry";
import { getLatestRun, getRunHistory, getSummary } from "@/lib/scrapers/RunTracker";
import { SOURCE_LABELS } from "@/lib/types";
import { Activity, Zap, AlertTriangle, Clock } from "lucide-react";
import { ScrapeNowButton } from "@/components/admin/ScrapeNowButton";

export const dynamic = "force-dynamic";

function relTime(d: Date | null): string {
  if (!d) return "henüz çalışmadı";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  const day = Math.floor(hr / 24);
  return `${day}g önce`;
}

const CRON_SCHEDULE_MIN = 30;

function nextRunIn(lastRun: Date | null): string {
  if (!lastRun) return "bilinmiyor";
  const elapsed = (Date.now() - lastRun.getTime()) / 60_000;
  const remaining = Math.max(0, CRON_SCHEDULE_MIN - elapsed);
  if (remaining < 1) return "her an";
  return `~${Math.ceil(remaining)}dk`;
}

export default function AdminScrapersPage() {
  const scrapers = scraperRegistry.list();
  const summary = getSummary();
  const hasAny = summary.totalRuns > 0;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-3">
        <StatCard icon={Activity} label="Toplam çalışma" value={summary.totalRuns} color="from-violet-500 to-purple-500" />
        <StatCard icon={Zap} label="Çekilen etkinlik" value={summary.totalEvents} color="from-emerald-500 to-teal-500" />
        <StatCard icon={AlertTriangle} label="Başarısız" value={summary.failedRuns} color="from-rose-500 to-red-500" />
        <StatCard icon={Clock} label="Son çalışma" value={hasAny ? relTime(summary.lastRunAt) : "—"} color="from-amber-500 to-orange-500" valueClassName="text-base" />
      </div>

      <ScrapeNowButton />

      {!hasAny && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)]/30 p-5 text-center text-sm text-[var(--muted)]">
          Bu oturumda henüz bot çalışmamış (tracker in-memory&apos;dir, cold-start&apos;ta sıfırlanır).
          Yukarıdaki <strong>Tüm verileri çek</strong> butonuyla hemen tetikleyebilirsin.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {scrapers.map((s) => {
          const latest = getLatestRun(s.source);
          const history = getRunHistory(s.source).slice(0, 8);
          const successRate = history.length
            ? Math.round((history.filter((r) => r.success).length / history.length) * 100)
            : null;

          const statusColor = !latest
            ? "bg-[var(--muted-bg)] text-[var(--muted)] ring-[var(--border)]"
            : latest.success
              ? "bg-[var(--success)]/15 text-[var(--success)] ring-[var(--success)]/30"
              : "bg-[var(--danger)]/15 text-[var(--danger)] ring-[var(--danger)]/30";

          const statusText = !latest ? "bekleniyor" : latest.success ? "aktif" : "hata";

          return (
            <div key={s.source} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{s.source}</div>
                  <h3 className="font-semibold text-lg">{SOURCE_LABELS[s.source]}</h3>
                  <a href={s.baseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--primary)] hover:underline break-all">
                    {s.baseUrl}
                  </a>
                </div>
                <span className={`rounded-full ring-1 px-2.5 py-1 text-xs font-medium whitespace-nowrap ${statusColor}`}>
                  {statusText}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <KV label="Son çalışma" value={latest ? relTime(latest.startedAt) : "—"} />
                <KV label="Sonraki" value={nextRunIn(latest?.startedAt ?? null)} />
                <KV label="Başarı" value={successRate != null ? `%${successRate}` : "—"} />
              </div>

              {latest && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]/30 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Son sonuç</span>
                    <span className="font-mono">{latest.durationMs}ms • {latest.eventCount} etkinlik</span>
                  </div>
                  {latest.errorMessage && (
                    <div className="mt-1 text-[var(--danger)]">⚠ {latest.errorMessage}</div>
                  )}
                </div>
              )}

              {history.length > 1 && (
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1.5">Geçmiş ({history.length} çalışma)</div>
                  <div className="flex items-end gap-1 h-12">
                    {history.slice().reverse().map((r, i) => {
                      const maxCount = Math.max(...history.map((x) => x.eventCount), 1);
                      const h = Math.max(8, (r.eventCount / maxCount) * 100);
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-t ${r.success ? "bg-[var(--success)]/40" : "bg-[var(--danger)]/40"}`}
                          style={{ height: `${h}%` }}
                          title={`${r.startedAt.toLocaleTimeString("tr-TR")} • ${r.eventCount} etkinlik • ${r.durationMs}ms`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="font-semibold mb-3">Cron yapılandırması</h3>
        <p className="text-sm text-[var(--muted)] mb-3">
          Bu sayfa <strong>in-memory</strong> tracker'dan okuyor — server yeniden başlatılırsa geçmiş sıfırlanır.
          Kalıcı izleme için <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5">ScraperRun</code> tablosuna yazılması yeterli (Prisma şeması zaten mevcut).
        </p>
        <ul className="text-sm space-y-1.5">
          <li>• <strong>Schedule:</strong> her {CRON_SCHEDULE_MIN} dakikada (<code>*/30 * * * *</code>) — <code>vercel.json</code></li>
          <li>• <strong>Endpoint:</strong> <code>/api/cron/scrape</code></li>
          <li>• <strong>Auth:</strong> <code>Authorization: Bearer $CRON_SECRET</code> (env var)</li>
          <li>• <strong>Vercel Cron:</strong> sadece production'da çalışır, preview deploy'larda değil</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color, valueClassName,
}: {
  icon: typeof Activity; label: string; value: string | number; color: string; valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className={`mb-2 inline-grid size-8 place-items-center rounded-lg bg-gradient-to-br ${color} text-white`}>
        <Icon className="size-4" />
      </div>
      <div className={`font-bold ${valueClassName ?? "text-2xl"}`}>{value}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5">{label}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--muted-bg)]/50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
