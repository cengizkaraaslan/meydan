import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, User, CalendarDays, Flag, CheckCircle2 } from "lucide-react";
import { getReport, type Report } from "@/lib/reports-store";
import { ReportActions } from "./ReportActions";

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<Report["reason"], string> = {
  spam: "Spam",
  harassment: "Taciz",
  hate: "Nefret söylemi",
  inappropriate: "Uygunsuz içerik",
  scam: "Dolandırıcılık",
  other: "Diğer",
};

const TARGET_META: Record<
  Report["target"],
  { label: string; icon: typeof MessageSquare; color: string }
> = {
  comment: { label: "Yorum", icon: MessageSquare, color: "text-blue-500" },
  user: { label: "Kullanıcı", icon: User, color: "text-violet-500" },
  event: { label: "Etkinlik", icon: CalendarDays, color: "text-emerald-500" },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function targetLink(r: Report): { href: string; label: string } | null {
  if (r.target === "comment" && r.targetContext) {
    return { href: `/etkinlik/${r.targetContext}`, label: `Etkinlik: ${r.targetContext}` };
  }
  if (r.target === "event") {
    return { href: `/etkinlik/${r.targetId}`, label: `Etkinlik sayfası` };
  }
  if (r.target === "user") {
    return { href: `/profil/${r.targetId}`, label: `@${r.targetId} profili` };
  }
  return null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminReportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const report = getReport(id);
  if (!report) notFound();

  const meta = TARGET_META[report.target];
  const Icon = meta.icon;
  const link = targetLink(report);
  const resolved = report.status !== "open";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/raporlar"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="size-4" /> Raporlara dön
      </Link>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className={`inline-grid size-11 place-items-center rounded-xl bg-[var(--muted-bg)] ${meta.color} shrink-0`}>
            <Icon className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{meta.label} raporu</h2>
              <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/30 px-2 py-0.5 text-xs font-medium">
                {REASON_LABELS[report.reason]}
              </span>
              {resolved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] ring-1 ring-[var(--success)]/30 px-2 py-0.5 text-xs font-medium">
                  <CheckCircle2 className="size-3" />
                  {report.status === "actioned" ? "Aksiyon alındı" : "Reddedildi"}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              {fmtDate(report.createdAt)} · ID: {report.id}
            </p>
          </div>
        </div>

        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Hedef
            </dt>
            <dd className="font-medium break-all">{report.targetId}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Bildiren
            </dt>
            <dd className="font-medium break-all">{report.reporterEmail}</dd>
          </div>
          {report.targetContext && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
                Bağlam
              </dt>
              <dd>
                <Link
                  href={`/etkinlik/${report.targetContext}`}
                  className="text-[var(--primary)] hover:underline"
                >
                  /etkinlik/{report.targetContext}
                </Link>
              </dd>
            </div>
          )}
          {link && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
                Hedef bağlantısı
              </dt>
              <dd>
                <Link
                  href={link.href}
                  className="text-[var(--primary)] hover:underline"
                >
                  {link.label}
                </Link>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
            İçerik özeti
          </div>
          <blockquote className="rounded-xl border-s-4 border-[var(--accent)] bg-[var(--muted-bg)]/60 px-4 py-3 text-sm whitespace-pre-wrap break-words">
            {report.targetExcerpt || (
              <em className="text-[var(--muted)]">— İçerik özeti yok —</em>
            )}
          </blockquote>
        </div>

        {report.note && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
              Bildirenin notu
            </div>
            <p className="text-sm whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              {report.note}
            </p>
          </div>
        )}
      </div>

      {!resolved ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <Flag className="size-4 text-[var(--primary)]" />
            Aksiyon
          </h3>
          <p className="text-xs text-[var(--muted)] mb-4">
            Bu rapor için bir karar ver. Aksiyon alındıktan sonra rapor kapanır.
          </p>
          <ReportActions reportId={report.id} canBan={report.target === "user"} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[var(--success)]" />
            Çözüm geçmişi
          </h3>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
                Durum
              </dt>
              <dd className="font-medium">
                {report.status === "actioned" ? "Aksiyon alındı" : "Reddedildi"}
                {report.resolutionAction ? ` (${report.resolutionAction})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
                Çözen
              </dt>
              <dd className="font-medium break-all">{report.resolvedBy ?? "—"}</dd>
            </div>
            {report.resolvedAt && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
                  Çözüldü
                </dt>
                <dd className="font-medium">{fmtDate(report.resolvedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
