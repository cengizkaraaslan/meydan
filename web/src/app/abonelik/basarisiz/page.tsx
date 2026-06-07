import Link from "next/link";
import { XCircle } from "lucide-react";

type SearchParams = Promise<{ reason?: string }>;

export default async function PaymentFailurePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const reason = params.reason ?? "Bilinmeyen bir hata oluştu.";

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <div className="mx-auto size-16 rounded-full bg-[var(--accent)]/15 grid place-items-center text-[var(--accent)]">
          <XCircle className="size-8" />
        </div>
        <h1 className="mt-5 text-2xl sm:text-3xl font-bold">Ödeme tamamlanamadı</h1>
        <p className="mt-3 text-[var(--muted)]">{reason}</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Hiç ücret yansıtılmadı. Tekrar denemek istersen plan sayfasına dönebilirsin.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/abonelik"
            className="rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-3 text-sm font-semibold hover:opacity-95 transition-opacity"
          >
            Tekrar dene
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold hover:bg-[var(--muted-bg)] transition-colors"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}
