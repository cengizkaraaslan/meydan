import Link from "next/link";
import { Flag, MessageSquare, User, CalendarDays, ArrowRight } from "lucide-react";
import { listReports, getOpenCount, type ReportStatus, type Report } from "@/lib/reports-store";

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<Report["reason"], string> = {
  spam: "Spam",
  harassment: "Taciz",
  hate: "Nefret",
  inappropriate: "Uygunsuz",
  scam: "Dolandırıcılık",
  other: "Diğer",
};

const TARGET_META: Record<Report["target"], { label: string; icon: typeof MessageSquare; color: string }> = {
  comment: { label: "Yorum", icon: MessageSquare, color: "text-blue-500" },
  user: { label: "Kullanıcı", icon: User, color: "text-violet-500" },
  event: { label: "Etkinlik", icon: CalendarDays, color: "text-emerald-500" },
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Açık",
  dismissed: "Reddedildi",
  actioned: "Aksiyon alındı",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  return `${Math.floor(hr / 24)}g önce`;
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawStatus = sp.status;
  let activeFilter: ReportStatus | "all";
  if (rawStatus === "open" || rawStatus === "dismissed" || rawStatus === "actioned" || rawStatus === "all") {
    activeFilter = rawStatus;
  } else {
    activeFilter = "open";
  }

  const reports =
    activeFilter === "all" ? listReports() : listReports({ status: activeFilter });
  const openCount = getOpenCount();

  const tabs: { key: ReportStatus | "all"; label: string; href: string }[] = [
    { key: "open", label: "Açık", href: "/admin/raporlar?status=open" },
    { key: "actioned", label: "Aksiyon alındı", href: "/admin/raporlar?status=actioned" },
    { key: "dismissed", label: "Reddedildi", href: "/admin/raporlar?status=dismissed" },
    { key: "all", label: "Hepsi", href: "/admin/raporlar?status=all" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-grid size-10 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-500 text-white">
            <Flag className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Raporlar
              {openCount > 0 && (
                <span className="rounded-full bg-[var(--danger)] text-white text-xs px-2 py-0.5 font-medium">
                  {openCount} açık
                </span>
              )}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Kullanıcı bildirimlerini incele ve aksiyon al
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => {
          const active = t.key === activeFilter;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
          <Flag className="size-10 mx-auto text-[var(--muted)] mb-3" />
          <div className="text-sm text-[var(--muted)]">Bu kategoride rapor yok.</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const meta = TARGET_META[r.target];
            const Icon = meta.icon;
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className={`inline-grid size-9 place-items-center rounded-xl bg-[var(--muted-bg)] ${meta.color} shrink-0`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline flex-wrap gap-2 mb-1">
                      <span className="text-sm font-semibold">{meta.label}</span>
                      <span className="text-xs text-[var(--muted)] truncate max-w-[200px]">
                        {r.targetId}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                        {REASON_LABELS[r.reason]}
                      </span>
                      {r.status !== "open" && (
                        <span className="inline-flex items-center rounded-full bg-[var(--muted-bg)] ring-1 ring-[var(--border)] px-2 py-0.5 text-[10px] font-medium">
                          {STATUS_LABELS[r.status]}
                        </span>
                      )}
                      <span className="ms-auto text-xs text-[var(--muted)] shrink-0">
                        {relTime(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted)] break-words line-clamp-2">
                      {r.targetExcerpt || <em className="text-[var(--muted)]">— içerik yok —</em>}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-[var(--muted)]">
                        <span>Bildiren: </span>
                        <span className="font-medium text-[var(--foreground)]">{r.reporterEmail}</span>
                      </div>
                      <Link
                        href={`/admin/raporlar/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        İncele <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
