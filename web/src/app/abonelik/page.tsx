import { Check } from "lucide-react";
import { auth } from "@/auth";
import { PLAN_LIMITS } from "@/lib/types";
import UpgradeButton from "./UpgradeButton";

export default async function PricingPage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.email);
  const iyzicoConfigured = Boolean(
    process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY && process.env.IYZICO_BASE_URL,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
      <header className="text-center max-w-2xl mx-auto">
        <div className="text-xs uppercase tracking-wider text-[var(--primary)] font-semibold">Planlar</div>
        <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">
          API&apos;yi <span className="gradient-text">sınırsız</span> kullan
        </h1>
        <p className="mt-4 text-[var(--muted)]">
          Site tamamen ücretsiz. Sadece public API kullanımı planlıdır. Aşağıdaki plan seni en iyi tanımlıyor:
        </p>
      </header>

      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {Object.values(PLAN_LIMITS).map((p) => {
          const popular = p.plan === "PRO";
          const isFree = p.monthlyPriceTL === 0;
          return (
            <div
              key={p.plan}
              className={`relative rounded-3xl border bg-[var(--card)] p-6 ${
                popular ? "border-[var(--primary)] glow-primary" : "border-[var(--border)]"
              }`}
            >
              {popular && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1 text-xs font-semibold">
                  EN POPÜLER
                </span>
              )}
              <div className="text-sm font-semibold text-[var(--muted)]">{p.plan}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  {isFree ? "₺0" : `₺${p.monthlyPriceTL}`}
                </span>
                <span className="text-sm text-[var(--muted)]">/ay</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm">
                <Feature>{p.requestsPerDay.toLocaleString("tr-TR")} istek / gün</Feature>
                <Feature included={p.priceAlertsEnabled}>Fiyat alarmı</Feature>
                <Feature included={p.webhooksEnabled}>Webhook bildirimleri</Feature>
                <Feature included={p.priorityRouting}>Öncelikli rota & destek</Feature>
              </ul>
              <UpgradeButton
                plan={p.plan}
                isFree={isFree}
                popular={popular}
                isLoggedIn={isLoggedIn}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-[var(--muted)]">
        {iyzicoConfigured
          ? "Ödeme iyzico sandbox modunda çalışıyor — gerçek kart bilgisi gerekmez."
          : "Ödeme yapılandırılmamış. iyzico anahtarları .env.local'a eklendiğinde aktifleşir."}
      </p>
    </div>
  );
}

function Feature({ children, included = true }: { children: React.ReactNode; included?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${included ? "" : "opacity-40 line-through"}`}>
      <Check className="size-4 mt-0.5 text-[var(--success)] shrink-0" />
      <span>{children}</span>
    </li>
  );
}
