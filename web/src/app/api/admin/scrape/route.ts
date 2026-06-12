import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { fanOutScrape } from "@/lib/scrapers/runAndPersist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin panelinden "Tüm verileri çek" butonu bunu tetikler.
 * Cron (/api/cron/scrape) ile AYNI helper'ı kullanır ama CRON_SECRET yerine oturum kontrolü
 * ister (tarayıcıdan tıklanabilsin diye). Tüm scraper'ları çalıştırır, sonuçları
 * Neon'a (db.event) yazar, sayfa cache'lerini tazeler ve kaynak-bazlı özet döner.
 */
export async function POST(request: NextRequest) {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Giriş yapmalısın" }, { status: 401 });
  }

  const usingMock = process.env.USE_MOCK_DATA === "true";
  // Fan-out: tek lambda'da tüm scraper'lar 60sn'yi aşar → cron leaf'lerine paralel dağıt.
  const n = Number(process.env.SCRAPE_SHARDS) || 6;
  const results = await fanOutScrape(new URL(request.url).origin, n, process.env.CRON_SECRET);

  revalidatePath("/");
  revalidatePath("/etkinlikler");
  revalidatePath("/etkinlik", "layout");

  const totalEvents = results.reduce((sum, r) => sum + r.eventCount, 0);
  const totalWritten = results.reduce((sum, r) => sum + r.written, 0);
  const sorted = results
    .map((r) => ({
      source: r.source,
      success: r.success,
      event_count: r.eventCount,
      written: r.written,
      duration_ms: r.durationMs,
      error: r.error,
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
