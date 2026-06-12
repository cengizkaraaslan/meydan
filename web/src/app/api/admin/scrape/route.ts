import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runAndPersistAll } from "@/lib/scrapers/runAndPersist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin panelinden "Tüm verileri çek" butonu bunu tetikler.
 * Cron ile AYNI helper'ı kullanır (mutlak süre bütçeli → 200 döner); CRON_SECRET yerine oturum
 * ister. O turda bütçeye sığan kaynakları Neon'a yazar ve kaynak-bazlı özet döner. (Günlük cron
 * rotasyonu zaten tüm kaynakları ~2 günde tarar; bu buton elle bir tur tetikler.)
 */
export async function POST() {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Giriş yapmalısın" }, { status: 401 });
  }

  const usingMock = process.env.USE_MOCK_DATA === "true";
  const results = await runAndPersistAll();

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
