import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Etkinlik detayı sunucuda render edilirken (force-dynamic + çok sayıda store çağrısı)
 * anında gösterilen iskelet. Algılanan bekleme süresini ortadan kaldırır.
 */
export default function EventDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Geri / breadcrumb */}
      <Skeleton className="h-4 w-40 mb-6" />

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-6">
          {/* Kapak görseli */}
          <Skeleton className="aspect-[16/9] w-full rounded-2xl" />

          {/* Rozetler */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Başlık */}
          <div className="space-y-2">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-9 w-1/2" />
          </div>

          {/* Tarih/konum satırları */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>

          {/* Açıklama */}
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>

        {/* Sağ panel (fiyat/RSVP/bilet) */}
        <aside className="space-y-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </aside>
      </div>
    </div>
  );
}
