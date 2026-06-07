import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { MyEventsManager } from "@/components/MyEventsManager";

export const metadata = {
  title: "Etkinliklerim — MeydanFest",
  description: "Yayınladığın etkinlikleri yönet, taslak ve beklemedekileri düzenle.",
};

export default function MyEventsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/yayinla"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        Etkinlik yayınla
      </Link>

      <div className="mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
          <LayoutDashboard className="size-3.5 text-[var(--accent)]" />
          Organizatör paneli
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Etkinliklerim</h1>
        <p className="text-sm text-[var(--muted)]">
          Oluşturduğun etkinlikleri yönet. Taslakları düzenle, yayındakilerin
          istatistiklerini gör.
        </p>
      </div>

      <MyEventsManager />
    </div>
  );
}
