import { getRecentRuns } from "@/lib/scrapers/RunTracker";
import { SOURCE_LABELS } from "@/lib/types";
import { Activity, UserPlus, MessageSquare, Heart, AlertTriangle, Zap } from "lucide-react";

type LogType = "scrape" | "user" | "comment" | "like" | "error" | "api";

interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  details?: string;
  createdAt: Date;
}

const TYPE_META: Record<LogType, { color: string; bg: string; icon: typeof Activity; label: string }> = {
  scrape:  { color: "text-violet-500",  bg: "bg-violet-500/10",  icon: Activity,       label: "Scraper" },
  user:    { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: UserPlus,       label: "Kullanıcı" },
  comment: { color: "text-blue-500",    bg: "bg-blue-500/10",    icon: MessageSquare,  label: "Yorum" },
  like:    { color: "text-rose-500",    bg: "bg-rose-500/10",    icon: Heart,          label: "Beğeni" },
  error:   { color: "text-red-500",     bg: "bg-red-500/10",     icon: AlertTriangle,  label: "Hata" },
  api:     { color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Zap,            label: "API" },
};

function mockEntries(): LogEntry[] {
  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60_000);
  return [
    { id: "l1",  type: "user",    message: "Yeni üye kaydoldu",        details: "@onuro · Google ile giriş",        createdAt: min(2) },
    { id: "l2",  type: "comment", message: "Yorum eklendi",            details: "@elif → 'Cem Yılmaz • CMYLMZ 2026'",createdAt: min(5) },
    { id: "l3",  type: "like",    message: "Etkinlik beğenildi",       details: "@burak → 'Rock'n Coke 2026'",       createdAt: min(7) },
    { id: "l4",  type: "api",     message: "API anahtarı oluşturuldu", details: "@selin · plan: PRO",                createdAt: min(12) },
    { id: "l5",  type: "comment", message: "Yorum eklendi",            details: "@mert → 'FB-GS Derbisi'",           createdAt: min(18) },
    { id: "l6",  type: "user",    message: "Profil güncellendi",       details: "@zeynep · IG hesabı bağlandı",      createdAt: min(24) },
    { id: "l7",  type: "error",   message: "Scraper hatası",           details: "PASSO · 503 Service Unavailable",   createdAt: min(46) },
    { id: "l8",  type: "user",    message: "Yeni üye kaydoldu",        details: "@yusuf · Google ile giriş",         createdAt: min(60) },
    { id: "l9",  type: "like",    message: "Etkinlik beğenildi",       details: "@deniz → 'maNga • İstanbul'",       createdAt: min(75) },
    { id: "l10", type: "api",     message: "Rate limit aşıldı",        details: "API key es_xxxx · 10k/gün",          createdAt: min(110) },
  ];
}

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  return `${Math.floor(hr / 24)}g önce`;
}

export const dynamic = "force-dynamic";

export default function AdminLogsPage() {
  const scrapeLogs: LogEntry[] = getRecentRuns(10).map((r) => ({
    id: `s${r.startedAt.getTime()}-${r.source}`,
    type: r.success ? "scrape" : "error",
    message: r.success ? "Scraper tamamlandı" : "Scraper hatası",
    details: `${SOURCE_LABELS[r.source]} · ${r.eventCount} etkinlik · ${r.durationMs}ms${r.errorMessage ? " · " + r.errorMessage : ""}`,
    createdAt: r.startedAt,
  }));

  const all = [...scrapeLogs, ...mockEntries()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const grouped = new Map<string, LogEntry[]>();
  for (const e of all) {
    const d = e.createdAt;
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const key = isToday ? "Bugün" : isYesterday ? "Dün" : d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    const list = grouped.get(key) ?? [];
    list.push(e);
    grouped.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Sistem Logları</h2>
          <p className="text-sm text-[var(--muted)]">Son aktiviteler · gerçek zamanlı</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(TYPE_META).map(([k, m]) => (
            <span key={k} className={`inline-flex items-center gap-1 rounded-full ${m.bg} ${m.color} px-2.5 py-1 text-xs font-medium`}>
              <m.icon className="size-3" /> {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {[...grouped.entries()].map(([day, items]) => (
          <section key={day}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{day}</h3>
            <ol className="relative border-s border-[var(--border)] ms-3 ps-6 space-y-3">
              {items.map((e) => {
                const meta = TYPE_META[e.type];
                return (
                  <li key={e.id} className="relative">
                    <span className={`absolute -start-[34px] top-1.5 grid size-7 place-items-center rounded-full ${meta.bg} ring-4 ring-[var(--background)]`}>
                      <meta.icon className={`size-3.5 ${meta.color}`} />
                    </span>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-medium text-sm">{e.message}</div>
                        <span className="text-xs text-[var(--muted)] shrink-0">{relTime(e.createdAt)}</span>
                      </div>
                      {e.details && <div className="mt-1 text-xs text-[var(--muted)] break-all">{e.details}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
