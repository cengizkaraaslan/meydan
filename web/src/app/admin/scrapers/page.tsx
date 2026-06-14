import { scraperRegistry } from "@/lib/scrapers/ScraperRegistry";
import {
  getLatestRun,
  getSummary,
  getDbSummary,
  getLatestRunPerSourceFromDb,
  getRecentRunsFromDb,
  type PersistedRun,
} from "@/lib/scrapers/RunTracker";
import { SOURCE_LABELS } from "@/lib/types";
import { Activity, Zap, AlertTriangle, Clock } from "lucide-react";
import { ScrapeNowButton } from "@/components/admin/ScrapeNowButton";
import { auth } from "@/auth";

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

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] ?? source;
}

// (nextRunIn kaldırıldı — schedule artık günlük; "Sonraki" sütunu gösterilmiyor.)

/** Bir kaynak için kart verisi — DB veya in-memory'den normalize edilir. */
interface SourceView {
  startedAt: Date;
  durationMs: number;
  success: boolean;
  eventCount: number;
  errorMessage: string | null;
}

export default async function AdminScrapersPage() {
  const scrapers = scraperRegistry.list();
  const usingMock = process.env.USE_MOCK_DATA === "true";

  const session = await auth().catch(() => null);
  const adminEmail = session?.user?.email ?? "";
  const sources = scrapers.map((s) => ({ source: String(s.source), label: s.displayName }));

  // MuzeScraper registry'de DEĞİL (günlük event cron'unu bozmasın) → kartını elle ekle.
  // ScrapeNowButton'a EKLENMEZ (o yolla tetiklenmez); yalnız son çalışma/hata gösterimi için.
  const cards = [
    ...scrapers.map((s) => ({ source: String(s.source), baseUrl: s.baseUrl })),
    { source: "MUZE_GOV", baseUrl: "https://muze.gov.tr" },
  ];

  // ÖNCE kalıcı DB'den oku; DB boş/yapılandırılmamışsa in-memory tracker'a düş.
  const dbSummary = await getDbSummary(48);
  const useDb = dbSummary.totalRuns > 0;

  const memSummary = getSummary();
  const summary = useDb ? dbSummary : memSummary;
  const hasAny = summary.totalRuns > 0;

  const dbLatestPerSource = useDb ? await getLatestRunPerSourceFromDb() : new Map<string, PersistedRun>();
  const recentRuns = useDb ? await getRecentRunsFromDb(100) : [];

  function viewForSource(source: string): SourceView | null {
    if (useDb) {
      const r = dbLatestPerSource.get(source);
      if (!r) return null;
      return {
        startedAt: r.startedAt,
        durationMs: r.durationMs,
        success: r.success,
        eventCount: r.itemsFound,
        errorMessage: r.errorMessage,
      };
    }
    const latest = getLatestRun(source);
    if (!latest) return null;
    return {
      startedAt: latest.startedAt,
      durationMs: latest.durationMs,
      success: latest.success,
      eventCount: latest.eventCount,
      errorMessage: latest.errorMessage ?? null,
    };
  }

  return (
    <div className="space-y-6">
      {usingMock && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <strong>⚠ MOCK MODE AÇIK</strong> — gerçek veri çekilmiyor, sahte/boş veri yazılıyor.
          Prod&apos;da <code className="rounded bg-amber-500/20 px-1.5 py-0.5">USE_MOCK_DATA</code> env&apos;ini kaldır.
        </div>
      )}
      <div className="grid sm:grid-cols-4 gap-3">
        <StatCard icon={Activity} label="Toplam çalışma" value={summary.totalRuns} color="from-violet-500 to-purple-500" />
        <StatCard icon={Zap} label="Çekilen etkinlik" value={summary.totalEvents} color="from-emerald-500 to-teal-500" />
        <StatCard icon={AlertTriangle} label="Başarısız" value={summary.failedRuns} color="from-rose-500 to-red-500" />
        <StatCard icon={Clock} label="Son çalışma" value={hasAny ? relTime(summary.lastRunAt) : "—"} color="from-amber-500 to-orange-500" valueClassName="text-base" />
      </div>

      <ScrapeNowButton email={adminEmail} sources={sources} />

      {!hasAny && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)]/30 p-5 text-center text-sm text-[var(--muted)]">
          Henüz bot çalışması kaydı yok.
          Yukarıdaki <strong>Tüm verileri çek</strong> butonuyla hemen tetikleyebilirsin.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((s) => {
          const view = viewForSource(s.source);

          const statusColor = !view
            ? "bg-[var(--muted-bg)] text-[var(--muted)] ring-[var(--border)]"
            : view.success
              ? "bg-[var(--success)]/15 text-[var(--success)] ring-[var(--success)]/30"
              : "bg-[var(--danger)]/15 text-[var(--danger)] ring-[var(--danger)]/30";

          const statusText = !view ? "bekleniyor" : view.success ? "aktif" : "hata";

          return (
            <div key={s.source} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{s.source}</div>
                  <h3 className="font-semibold text-lg">{sourceLabel(s.source)}</h3>
                  <a href={s.baseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--primary)] hover:underline break-all">
                    {s.baseUrl}
                  </a>
                </div>
                <span className={`rounded-full ring-1 px-2.5 py-1 text-xs font-medium whitespace-nowrap ${statusColor}`}>
                  {statusText}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <KV label="Son çalışma" value={view ? relTime(view.startedAt) : "—"} />
                <KV label="Durum" value={!view ? "—" : view.success ? "✓ başarılı" : "✗ hata"} />
              </div>

              {view && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]/30 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Son sonuç</span>
                    <span className="font-mono">{view.durationMs}ms • {view.eventCount} etkinlik</span>
                  </div>
                  {view.errorMessage && (
                    <div className="mt-1 text-[var(--danger)]">⚠ {view.errorMessage}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Son çalışmalar — kalıcı (ScraperRun) tablosundan detaylı log */}
      {recentRuns.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold mb-3">Son çalışmalar (detaylı log)</h3>
          <div className="max-h-[28rem] overflow-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-xs sm:text-sm">
              <thead className="sticky top-0 bg-[var(--muted-bg)]/80 backdrop-blur text-[var(--muted)]">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Zaman</th>
                  <th className="px-3 py-2 font-medium">Kaynak</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium text-right">Bulunan</th>
                  <th className="px-3 py-2 font-medium text-right">Yazılan</th>
                  <th className="px-3 py-2 font-medium text-right">Süre</th>
                  <th className="px-3 py-2 font-medium">Hata</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 whitespace-nowrap">{r.startedAt.toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{sourceLabel(r.source)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.success
                        ? <span className="text-[var(--success)]">✓</span>
                        : <span className="text-[var(--danger)]">✗</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.itemsFound}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.itemsCreated + r.itemsUpdated}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.durationMs}ms</td>
                    <td className="px-3 py-2">
                      {r.errorMessage
                        ? <span className="text-[var(--danger)]">{r.errorMessage}</span>
                        : <span className="text-[var(--muted)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="font-semibold mb-3">Cron yapılandırması</h3>
        <p className="text-sm text-[var(--muted)] mb-3">
          {useDb
            ? <>Çalışmalar artık <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5">ScraperRun</code> tablosuna yazılıyor (<strong>kalıcı</strong>) — bu sayfa DB&apos;den okuyor, cold-start&apos;ta kaybolmaz.</>
            : <>DB&apos;de henüz kayıt yok; bu sayfa şu an <strong>in-memory</strong> tracker&apos;a düşüyor (cold-start&apos;ta sıfırlanır). İlk scrape sonrası <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5">ScraperRun</code> tablosuna kalıcı yazılır.</>}
        </p>
        <ul className="text-sm space-y-1.5">
          <li>• <strong>Schedule:</strong> her gün 06:00 UTC = 09:00 TR (<code>0 6 * * *</code>) — <code>vercel.json</code></li>
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
