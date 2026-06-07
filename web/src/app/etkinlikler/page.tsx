import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { EventCard } from "@/components/EventCard";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { FilterPanel } from "@/components/FilterPanel";
import { PageFade } from "@/components/motion/PageFade";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { getEvents } from "@/lib/events";
import { Pagination } from "@/components/Pagination";
import type { EventCategory, EventSource } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SearchParams {
  city?: string;
  district?: string;
  category?: string;
  source?: string;
  free?: string;
  q?: string;
  date?: string;
  page?: string;
  [key: string]: string | undefined;
}

/** Türkiye sabit UTC+3 — preset'i Istanbul gününe göre from/to aralığına çevir. */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
function resolveDateRange(preset?: string): { from?: Date; to?: Date } {
  if (!preset || preset === "all") return {};
  const now = new Date();
  const ist = new Date(now.getTime() + TR_OFFSET_MS); // Istanbul "duvar saati"
  const midnightUtc = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm, dd) - TR_OFFSET_MS); // Istanbul gece yarısının UTC anı
  const startToday = midnightUtc(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const endOf = (start: Date) => new Date(start.getTime() + DAY_MS - 1);
  switch (preset) {
    case "today":
      return { from: startToday, to: endOf(startToday) };
    case "tomorrow": {
      const s = new Date(startToday.getTime() + DAY_MS);
      return { from: s, to: endOf(s) };
    }
    case "weekend": {
      const wd = ist.getUTCDay(); // 0 Paz ... 6 Cmt
      const satStart =
        wd === 0
          ? new Date(startToday.getTime() - DAY_MS) // bugün pazar → dün cumartesi
          : new Date(startToday.getTime() + ((6 - wd + 7) % 7) * DAY_MS);
      const sunEnd = endOf(new Date(satStart.getTime() + DAY_MS));
      const from = satStart.getTime() < startToday.getTime() ? startToday : satStart;
      return { from, to: sunEnd };
    }
    case "week":
      return { from: startToday, to: endOf(new Date(startToday.getTime() + 6 * DAY_MS)) };
    case "month":
      return { from: startToday, to: endOf(new Date(startToday.getTime() + 29 * DAY_MS)) };
    default:
      return {};
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getTranslations("events");

  return (
    <PageFade className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("title")}</h1>
      </div>
      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <FilterPanel />
        <Suspense fallback={<EventsSkeleton />}>
          <EventsGrid params={params} />
        </Suspense>
      </div>
    </PageFade>
  );
}

async function EventsGrid({ params }: { params: SearchParams }) {
  const t = await getTranslations("events");
  const { from, to } = resolveDateRange(params.date);
  const { events, total, page, totalPages } = await getEvents({
    city: params.city || undefined,
    district: params.district || undefined,
    category: (params.category as EventCategory) || undefined,
    source: (params.source as EventSource) || undefined,
    freeOnly: params.free === "1",
    search: params.q || undefined,
    from,
    to,
    page: params.page ? Number(params.page) : 1,
  });

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold">{t("no_results_title")}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("no_results_subtitle")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-sm text-[var(--muted)]">
        {t("result_count", { count: total })}
      </div>
      <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events.map((e, i) => (
          <EventCard key={e.id} event={e} index={i} />
        ))}
      </StaggerGrid>
      <Pagination page={page} totalPages={totalPages} params={params} />
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
