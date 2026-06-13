import Link from "next/link";
import { ShieldAlert, ArrowRight, MessageSquare } from "lucide-react";
import { listMobileReports } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  return `${Math.floor(hr / 24)}g önce`;
}

export default async function ChatReportsPage() {
  const reports = await listMobileReports();

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <ShieldAlert className="size-5 text-[var(--danger)]" />
        <h2 className="text-xl font-bold">Sohbet Şikayetleri</h2>
        <span className="text-sm text-[var(--muted)]">({reports.length})</span>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] p-10 text-center text-[var(--muted)]">
          Henüz şikayet yok.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/admin/sohbet-sikayet/${r.id}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3.5 hover:bg-[var(--muted-bg)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  Şikayet edilen: <span className="text-[var(--danger)]">{r.reportedName}</span>
                </div>
                <div className="text-sm text-[var(--muted)] truncate">
                  Eden: {r.reporterName} · Neden: <span className="font-medium">{r.reason}</span>
                </div>
              </div>
              {r.matchKey && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                  <MessageSquare className="size-3.5" /> sohbet
                </span>
              )}
              <span className="text-xs text-[var(--muted)] whitespace-nowrap">{relTime(r.createdAt)}</span>
              <ArrowRight className="size-4 text-[var(--muted)]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
