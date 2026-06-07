import Link from "next/link";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { CalendarDays, Users, Eye, MessageSquare, Activity, ArrowRight, Flag } from "lucide-react";
import { getRecentRuns } from "@/lib/scrapers/RunTracker";
import { SOURCE_LABELS } from "@/lib/types";
import { getOpenCount } from "@/lib/reports-store";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const recentRuns = getRecentRuns(8);
  const openReports = getOpenCount();

  const stats = [
    { label: "Kayıtlı üye",          value: "1.284",                       icon: Users,         color: "from-violet-500 to-purple-500" },
    { label: "Toplam etkinlik",      value: MOCK_EVENTS.length.toString(), icon: CalendarDays,  color: "from-amber-500 to-orange-500" },
    { label: "Bu ay görüntüleme",    value: "42.1k",                       icon: Eye,           color: "from-emerald-500 to-teal-500" },
    { label: "Yorumlar (24sa)",      value: "317",                         icon: MessageSquare, color: "from-rose-500 to-pink-500" },
  ];

  function relTime(d: Date) {
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "az önce";
    if (min < 60) return `${min}dk önce`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}sa önce`;
    return `${Math.floor(hr / 24)}g önce`;
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className={`mb-3 inline-grid size-10 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-white`}>
              <s.icon className="size-5" />
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-[var(--muted)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <Link
        href="/admin/raporlar"
        className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--primary)]/40 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="inline-grid size-12 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-500 text-white">
              <Flag className="size-5" />
            </div>
            {openReports > 0 && (
              <span className="absolute -top-1 -end-1 grid place-items-center min-w-[20px] h-5 px-1 rounded-full bg-[var(--danger)] text-white text-[10px] font-bold ring-2 ring-[var(--card)]">
                {openReports}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Raporlar</h3>
              {openReports > 0 && (
                <span className="rounded-full bg-[var(--danger)]/15 text-[var(--danger)] ring-1 ring-[var(--danger)]/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                  {openReports} açık
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Kullanıcıların bildirdiği yorum / kullanıcı / etkinlik raporlarını incele
            </p>
          </div>
          <ArrowRight className="size-4 text-[var(--muted)] group-hover:text-[var(--primary)] transition-colors" />
        </div>
      </Link>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-[var(--primary)]" />
              <h3 className="font-semibold">Bot sistemi</h3>
            </div>
            <Link href="/admin/scrapers" className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1">
              Detay <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentRuns.length === 0 ? (
            <div className="text-sm text-[var(--muted)] py-6 text-center">
              Henüz bot çalışmamış. <Link href="/api/cron/scrape" target="_blank" className="text-[var(--primary)] hover:underline">Şimdi tetikle</Link>
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentRuns.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                  <span className="font-medium">{SOURCE_LABELS[r.source]}</span>
                  <span className={r.success ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                    {r.success ? "✓" : "✗"} {relTime(r.startedAt)} · {r.eventCount} etkinlik · {r.durationMs}ms
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">API kullanımı (son 7 gün)</h3>
            <Link href="/admin/loglar" className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1">
              Loglar <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {[40, 65, 80, 55, 90, 72, 95].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-[var(--primary)]/30 to-[var(--primary)]" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-2 text-xs text-[var(--muted)] flex justify-between">
            <span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span>Cmt</span><span>Paz</span>
          </div>
        </div>
      </div>
    </div>
  );
}
