import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { scraperRegistry } from "@/lib/scrapers/ScraperRegistry";
import { recordRun } from "@/lib/scrapers/RunTracker";
import { setEventsForSource } from "@/lib/scrapers/EventCache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Scraper'ları senkron çalıştır + RunTracker'a kaydet
  const results = await scraperRegistry.runAll();
  for (const r of results) recordRun(r);

  // Scrape sonuçlarını Neon'a yaz (db.event, source != MANUAL) — kalıcı + herkese görünür
  let totalWritten = 0;
  for (const r of results) {
    if (r.success && r.events.length > 0) {
      totalWritten += await setEventsForSource(r.source, r.events);
    }
  }

  // Sayfa cache'lerini invalid et
  revalidatePath("/");
  revalidatePath("/etkinlikler");
  revalidatePath("/etkinlik", "layout");

  const totalEvents = results.reduce((sum, r) => sum + r.events.length, 0);

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    total_events: totalEvents,
    total_written: totalWritten,
    note: "Scrape sonuçları db.event'e yazıldı (Neon); sayfalar + public API bunları gösterir.",
    results: results.map((r) => ({
      source: r.source,
      success: r.success,
      event_count: r.events.length,
      duration_ms: r.finishedAt.getTime() - r.startedAt.getTime(),
      error: r.errorMessage,
    })),
  });
}
