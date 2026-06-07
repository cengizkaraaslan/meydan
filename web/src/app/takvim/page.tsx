import Link from "next/link";
import { CalendarDays, ArrowLeft } from "lucide-react";
import { EventCalendar } from "@/components/EventCalendar";
import { CalendarCitySelect } from "@/components/CalendarCitySelect";
import { getEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

interface SearchParams {
  city?: string;
  year?: string;
  month?: string;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth();
  const city = params.city;

  // 3 ay (önceki, mevcut, sonraki) etkinliklerini çek — kullanıcı ay değiştirdiğinde
  // anında veri görünsün diye geniş aralık alıyoruz.
  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month + 2, 0, 23, 59, 59);

  const { events } = await getEvents({
    city: city || undefined,
    from: rangeStart,
    to: rangeEnd,
    pageSize: 1000,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <header className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/etkinlikler"
            className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] mb-2"
          >
            <ArrowLeft className="size-3 rtl:rotate-180" /> Liste görünümü
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight inline-flex items-center gap-2">
            <CalendarDays className="size-7 sm:size-8 text-[var(--primary)]" />
            Etkinlik Takvimi
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Aylık görünümde tüm etkinlikleri keşfet. Şehir filtresi sağda.
          </p>
        </div>
        <CalendarCitySelect currentCity={city} />
      </header>

      <EventCalendar events={events} initialYear={year} initialMonth={month} cityFilter={city} />
    </div>
  );
}
