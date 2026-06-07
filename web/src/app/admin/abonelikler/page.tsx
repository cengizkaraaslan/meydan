import { PLAN_LIMITS } from "@/lib/types";

export default function AdminSubscriptionsPage() {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Aktif Free" value="1.184" />
        <Stat label="Aktif Pro" value="64" />
        <Stat label="Aktif Business" value="6" />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="font-semibold mb-3">Plan ayarları</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Ödeme provider'ı şu an <strong>mock</strong>. Stripe/iyzico anahtarları eklendiğinde otomatik geçer.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="text-start py-2">Plan</th>
                <th className="text-start py-2">Aylık (₺)</th>
                <th className="text-start py-2">İstek/gün</th>
                <th className="text-start py-2">Fiyat alarmı</th>
                <th className="text-start py-2">Webhook</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(PLAN_LIMITS).map((p) => (
                <tr key={p.plan} className="border-t border-[var(--border)]">
                  <td className="py-3 font-medium">{p.plan}</td>
                  <td className="py-3">{p.monthlyPriceTL}</td>
                  <td className="py-3">{p.requestsPerDay.toLocaleString("tr-TR")}</td>
                  <td className="py-3">{p.priceAlertsEnabled ? "✓" : "—"}</td>
                  <td className="py-3">{p.webhooksEnabled ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)] mt-1">{label}</div>
    </div>
  );
}
