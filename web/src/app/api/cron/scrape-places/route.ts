import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { runAndPersistPlaces } from "@/lib/scrapers/runPlaces";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Müze/gezilecek yer scraper'ı (muze.gov.tr, 81 il). Haftalık çalışır (günlük cron Pazartesi
 * tetikler) + buradan manuel tetiklenir (ilk doldurma; gerekirse 2-3 kez — bütçe-dolunca-bırak
 * deseniyle kalan müzelerin detayları sonraki çağrıda tamamlanır).
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/scrape-places
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ~52sn bütçe (Vercel 60sn altında). Liste (81 il) hep tamamlanır; detaylar bütçe içinde dolar.
  const summary = await runAndPersistPlaces({ budgetMs: 52_000, fetchDetails: true });

  revalidatePath("/");
  revalidatePath("/yerler");
  revalidatePath("/yer", "layout");

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    source: summary.source,
    success: summary.success,
    place_count: summary.placeCount,
    written: summary.written,
    created: summary.created,
    updated: summary.updated,
    duration_ms: summary.durationMs,
    error: summary.error,
    note: "Yerler Place tablosuna yazıldı; /yerler + anasayfa + /api/v1/places gösterir.",
  });
}
