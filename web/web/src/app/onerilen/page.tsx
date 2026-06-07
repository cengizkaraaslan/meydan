import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { ProposalCard } from "@/components/ProposalCard";
import { getProposals } from "@/lib/proposals";

export const revalidate = 600;

export default async function ProposalsPage() {
  const proposals = await getProposals();
  const pendingCount = proposals.filter((p) => p.status === "PENDING").length;
  const promotedCount = proposals.filter((p) => p.status === "PROMOTED").length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
            <Sparkles className="size-3.5 text-[var(--accent)]" />
            Topluluk önerileri
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Önerilen Etkinlikler</h1>
          <p className="text-sm text-[var(--muted)] max-w-xl">
            Kullanıcıların düzenlemek istediği etkinlikler. Bir öneri{" "}
            <strong>10 katılımcıya</strong> ulaşırsa gerçek etkinlik olarak yayına alınır.
          </p>
        </div>

        <Link
          href="/onerilen/yeni"
          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-3 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
        >
          <Plus className="size-4" />
          Yeni öneri
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md">
        <Stat label="Toplam" value={proposals.length} />
        <Stat label="Beklemede" value={pendingCount} />
        <Stat label="Etkinleşen" value={promotedCount} />
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">💡</div>
          <h3 className="text-lg font-semibold">Henüz öneri yok</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">İlk öneriyi sen oluştur.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {proposals.map((p, i) => (
            <ProposalCard key={p.id} proposal={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
