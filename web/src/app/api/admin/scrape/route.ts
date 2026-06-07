import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { scraperRegistry } from "@/lib/scrapers/ScraperRegistry";
import { recordRun, persistRun } from "@/lib/scrapers/RunTracker";
import { setEventsForSource } from "@/lib/scrapers/EventCache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin panelinden "Tüm verileri çek" butonu bunu tetikler.
 * Cron (/api/cron/scrape) ile aynı işi yapar ama CRON_SECRET yerine oturum kontrolü
 * ister (tarayıcıdan tıklanabilsin diye). Tüm scraper'ları çalıştırır, sonuçları
 * Neon'a (db.event) yazar, sayfa cache'lerini tazeler ve kaynak-bazlı özet döner.
 */
export async function POST() {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Giriş yapmalısın" }, { status: 401 });
  }

  const usingMock = process.env.USE_MOCK_DATA === "true";
  const results = await scraperRegistry.runAll();

  let totalWritten = 0;
  for (const r of results) {
    recordRun(r);
    const written = r.success && r.events.length > 0 ? await setEventsForSource(r.source, r.events) : 0;
    totalWritten += written;
    await persistRun(r, { created: written });
  }

  revalidatePath("/");
  revalidatePath("/etkinlikler");
  revalidatePath("/etkinlik", "layout");

  const totalEvents = results.reduce((sum, r) => sum + r.events.length, 0);
  const sorted = results
    .map((r) => ({
      source: r.source,
      success: r.success,
      event_count: r.events.length,
      duration_ms: r.finishedAt.getTime() - r.startedAt.getTime(),
      error: r.errorMessage,
    }))
    .sort((a, b) => b.event_count - a.event_count);

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    usingMock,
    scraper_count: results.length,
    success_count: results.filter((r) => r.success).length,
    total_events: totalEvents,
    total_written: totalWritten,
    results: sorted,
  });
}
