import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/types";

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <header>
        <div className="text-xs uppercase tracking-wider text-[var(--primary)] font-semibold">REST API v1</div>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">EtkinlikScout API</h1>
        <p className="mt-3 text-[var(--muted)] max-w-2xl">
          Türkiye'deki tüm etkinlikleri tek bir REST endpoint'le çek. Filtreleme, arama, sayfalama destekli. JSON formatında.
        </p>
      </header>

      <section className="grid sm:grid-cols-3 gap-4">
        {Object.values(PLAN_LIMITS).map((p) => (
          <div key={p.plan} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{p.plan}</div>
            <div className="mt-2 text-3xl font-bold">
              {p.monthlyPriceTL === 0 ? "Ücretsiz" : `${p.monthlyPriceTL}₺`}
              {p.monthlyPriceTL > 0 && <span className="text-sm font-normal text-[var(--muted)]">/ay</span>}
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>✓ {p.requestsPerDay.toLocaleString("tr-TR")} istek/gün</li>
              <li>{p.priceAlertsEnabled ? "✓" : "—"} Fiyat alarmı</li>
              <li>{p.webhooksEnabled ? "✓" : "—"} Webhook</li>
              <li>{p.priorityRouting ? "✓" : "—"} Öncelikli rota</li>
            </ul>
            <Link
              href="/abonelik"
              className="mt-5 block text-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-95"
            >
              {p.monthlyPriceTL === 0 ? "Hemen başla" : "Yükselt"}
            </Link>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Etkinlik listesi</h2>
        <CodeBlock lang="http">{`GET /api/v1/events?city=Istanbul&free=true&page=1
X-Api-Key: es_live_xxxxxxxx`}</CodeBlock>
        <h3 className="font-semibold mt-6">Query parametreleri</h3>
        <ParamTable rows={[
          ["city", "string", "Şehir adı (örn. Istanbul, Ankara)"],
          ["category", "enum", "KONSER, FESTIVAL, TIYATRO, STANDUP, SPOR, SERGI, ATOLYE, COCUK"],
          ["source", "enum", "BILETIX, BUBILET, MOBILET, PASSO, IBB, ANKARA_BB, IZMIR_BB"],
          ["free", "boolean", "true ise sadece ücretsiz"],
          ["q", "string", "Etkinlik/sanatçı arama"],
          ["from", "ISO date", "Bu tarihten sonra"],
          ["to", "ISO date", "Bu tarihten önce"],
          ["page", "int", "Sayfa numarası (default: 1)"],
          ["page_size", "int", "1-100 arası (default: 20)"],
        ]} />

        <h3 className="font-semibold mt-6">Yanıt örneği</h3>
        <CodeBlock lang="json">{`{
  "data": [
    {
      "id": "e1",
      "slug": "manga-konseri-istanbul",
      "source": "BILETIX",
      "title": "maNga • İstanbul Konseri",
      "category": "KONSER",
      "venue": "Volkswagen Arena",
      "city": "İstanbul",
      "starts_at": "2026-06-04T18:00:00.000Z",
      "price_min": 850,
      "price_max": 1850,
      "is_free": false,
      "ticket_url": "https://www.biletix.com/etkinlik/manga"
    }
  ],
  "meta": { "total": 134, "page": 1, "page_size": 20, "total_pages": 7 }
}`}</CodeBlock>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Tek etkinlik</h2>
        <CodeBlock lang="http">{`GET /api/v1/events/manga-konseri-istanbul
X-Api-Key: es_live_xxxxxxxx`}</CodeBlock>
      </section>
    </div>
  );
}

function CodeBlock({ children, lang }: { children: string; lang: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted-bg)]/40 overflow-hidden">
      <div className="px-4 py-2 text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
        {lang}
      </div>
      <pre className="p-4 text-sm overflow-x-auto font-mono">{children}</pre>
    </div>
  );
}

function ParamTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--muted-bg)]/40 text-xs uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="text-start px-4 py-2.5">Parametre</th>
            <th className="text-start px-4 py-2.5">Tip</th>
            <th className="text-start px-4 py-2.5">Açıklama</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([p, t, d]) => (
            <tr key={p} className="border-t border-[var(--border)]">
              <td className="px-4 py-2.5 font-mono text-[var(--primary)]">{p}</td>
              <td className="px-4 py-2.5 text-[var(--muted)]">{t}</td>
              <td className="px-4 py-2.5">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
