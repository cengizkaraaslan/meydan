import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { ProposalForm } from "@/components/ProposalForm";

export default function NewProposalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/onerilen"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        Tüm öneriler
      </Link>

      <div className="mb-6 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
          <Lightbulb className="size-3.5 text-[var(--accent)]" />
          Topluluğa öneride bulun
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Yeni etkinlik önerisi</h1>
        <p className="text-sm text-[var(--muted)]">
          Bir fikrini paylaş; 10 kişi katılmak istediğini söylerse gerçek etkinlik olarak yayına alalım.
        </p>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
        <ProposalForm />
      </div>
    </div>
  );
}
