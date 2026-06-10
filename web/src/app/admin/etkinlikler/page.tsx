import { MOCK_EVENTS } from "@/lib/mock-data";
import { formatEventDate, formatPrice } from "@/lib/utils";
import { CATEGORY_LABELS, SOURCE_LABELS, isUniversitySource } from "@/lib/types";

export default function AdminEventsPage() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="font-semibold">Etkinlikler ({MOCK_EVENTS.length})</h2>
        <button className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-sm">+ Manuel Ekle</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted-bg)]/50 text-[var(--muted)] text-xs uppercase tracking-wider">
            <tr>
              <th className="text-start px-4 py-3">Etkinlik</th>
              <th className="text-start px-4 py-3">Kategori</th>
              <th className="text-start px-4 py-3">Kaynak</th>
              <th className="text-start px-4 py-3">Tarih</th>
              <th className="text-start px-4 py-3">Fiyat</th>
              <th className="text-end px-4 py-3">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_EVENTS.map((e) => (
              <tr key={e.id} className="border-t border-[var(--border)] hover:bg-[var(--muted-bg)]/40">
                <td className="px-4 py-3">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-[var(--muted)]">{e.venue} • {e.city}</div>
                </td>
                <td className="px-4 py-3">{CATEGORY_LABELS[e.category]}</td>
                <td className="px-4 py-3">{SOURCE_LABELS[e.source]}</td>
                <td className="px-4 py-3">{formatEventDate(e.startsAt)}</td>
                <td className="px-4 py-3">{isUniversitySource(e.source) ? "🎓 Öğrenciye açık" : formatPrice(e.priceMin, e.priceMax, e.isFree, e.category)}</td>
                <td className="px-4 py-3 text-end">
                  <button className="text-xs text-[var(--primary)] hover:underline me-3">Düzenle</button>
                  <button className="text-xs text-[var(--danger)] hover:underline">Gizle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
