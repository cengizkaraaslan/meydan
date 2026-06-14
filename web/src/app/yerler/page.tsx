import { Suspense } from "react";
import type { Metadata } from "next";
import { PlaceCard } from "@/components/PlaceCard";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { PlaceFilterBar } from "@/components/PlaceFilterBar";
import { PageFade } from "@/components/motion/PageFade";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { Pagination } from "@/components/Pagination";
import { getPlaces } from "@/lib/places";
import type { PlaceType } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gezilecek Yerler & Müzeler",
  description: "Türkiye genelinde müzeler, örenyerleri ve gezilecek yerler — adres, ziyaret saatleri ve daha fazlası.",
};

interface SearchParams {
  city?: string;
  type?: string;
  q?: string;
  page?: string;
  [key: string]: string | undefined;
}

export default async function PlacesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return (
    <PageFade className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">🏛️ Gezilecek Yerler</h1>
        <p className="mt-2 text-[var(--muted)]">Türkiye genelinde müzeler, örenyerleri ve tarihî mekanlar.</p>
      </div>
      <div className="mb-6">
        <PlaceFilterBar />
      </div>
      <Suspense fallback={<PlacesSkeleton />}>
        <PlacesGrid params={params} />
      </Suspense>
    </PageFade>
  );
}

async function PlacesGrid({ params }: { params: SearchParams }) {
  const { places, total, page, totalPages } = await getPlaces({
    city: params.city || undefined,
    type: (params.type as PlaceType) || undefined,
    search: params.q || undefined,
    page: params.page ? Number(params.page) : 1,
  });

  if (places.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🏛️</div>
        <h3 className="text-lg font-semibold">Sonuç bulunamadı</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Farklı bir şehir veya tür deneyin.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-sm text-[var(--muted)]">{total} yer bulundu</div>
      <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {places.map((p, i) => (
          <PlaceCard key={p.id} place={p} index={i} />
        ))}
      </StaggerGrid>
      <Pagination page={page} totalPages={totalPages} params={params} />
    </div>
  );
}

function PlacesSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
