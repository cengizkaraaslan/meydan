import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_LIMITS, type SubscriptionPlan } from "@/lib/types";
import SubscriptionPersist from "./SubscriptionPersist";

type SearchParams = Promise<{ plan?: string; payment?: string }>;

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const planKey = (params.plan ?? "PRO").toUpperCase() as SubscriptionPlan;
  const plan = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.PRO;
  const paymentId = params.payment ?? "";

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center glow-primary">
        <div className="mx-auto size-16 rounded-full bg-[var(--success)]/15 grid place-items-center text-[var(--success)]">
          <Check className="size-8" />
        </div>
        <h1 className="mt-5 text-2xl sm:text-3xl font-bold">Ödeme başarılı</h1>
        <p className="mt-3 text-[var(--muted)]">
          Aboneliğin aktif: <span className="font-semibold text-[var(--primary)]">{plan.plan}</span>
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Aylık tutar: ₺{plan.monthlyPriceTL} — günlük {plan.requestsPerDay.toLocaleString("tr-TR")} istek hakkı.
        </p>
        {paymentId && (
          <p className="mt-2 text-xs text-[var(--muted)]">Ödeme ID: {paymentId}</p>
        )}

        <SubscriptionPersist plan={plan.plan} paymentId={paymentId} />

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/admin/abonelikler"
            className="rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-3 text-sm font-semibold hover:opacity-95 transition-opacity"
          >
            Aboneliği yönet
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
