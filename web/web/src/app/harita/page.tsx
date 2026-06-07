import { MapPinned, MousePointerClick } from "lucide-react";
import { TurkeyMap } from "@/components/TurkeyMap";
import { getEvents } from "@/lib/events";
import type { EventCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SearchParams {
  category?: string;
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // Tüm aktif etkinlikleri çek — istemci tarafı kategori/tarih/ücret filtreleri uygular.
  // NOT: kategori parametresini sunucuda DEĞİL, istemcide süzeriz ki kullanıcı
  // chip'lerle değiştirdiğinde tüm dataset zaten elinde olsun.
  const { events } = await getEvents({ pageSize: 1000 });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <header className="mb-5">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight inline-flex items-center gap-2">
          <MapPinned className="size-7 sm:size-8 text-[var(--primary)]" />
          Türkiye Etkinlik Haritası
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)] inline-flex items-center gap-1.5 flex-wrap">
          <MousePointerClick className="size-3.5" />
          Şehri keşfet, pin'e tıkla → o şehrin etkinlik listesi açılsın.
          Büyük pin = daha çok etkinlik.
        </p>
      </header>

      <TurkeyMap events={events} initialCategory={params.category} />
    </div>
  );
}
