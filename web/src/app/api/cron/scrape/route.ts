import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { runAndPersistAll } from "@/lib/scrapers/runAndPersist";
import { runAndPersistPlaces } from "@/lib/scrapers/runPlaces";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hobby (tek vCPU + 60sn): runAndPersistAll mutlak süre bütçesiyle (~52sn) çalışır → bütçe
  // dolunca durur ve 200 döner (asla 504 yok). Her kaynak bittiği anda Neon'a yazılır. Günlük
  // rotasyon sayesinde tüm 109 kaynak ~2 günde taranır (detaylar runAndPersist.ts).
  const usingMock = process.env.USE_MOCK_DATA === "true";

  // Vercel Hobby 2-cron limiti aşılmasın diye AYRI haftalık cron eklemiyoruz: müze/yer scraper'ını
  // Pazartesi günleri burada tetikliyoruz (~20sn bütçe; liste hep tamamlanır, yeni müzeler eklenir,
  // detaylar haftalar içinde dolar). Manuel tam doldurma /api/cron/scrape-places ile yapılır.
  let places: Awaited<ReturnType<typeof runAndPersistPlaces>> | null = null;
  if (new Date().getUTCDay() === 1) {
    try {
      places = await runAndPersistPlaces({ budgetMs: 20_000, fetchDetails: true });
    } catch (err) {
      console.warn("[cron/scrape] yer scraper hatası:", err instanceof Error ? err.message : err);
    }
  }

  const results = await runAndPersistAll();

  // TODO (#25 — bildirim): yeni etkinlik tespit edilince eşleşen cihazlara push gönder.

  // Sayfa cache'lerini invalid et
  revalidatePath("/");
  revalidatePath("/etkinlikler");
  revalidatePath("/etkinlik", "layout");
  if (places) {
    revalidatePath("/yerler");
    revalidatePath("/yer", "layout");
  }

  const totalEvents = results.reduce((sum, r) => sum + r.eventCount, 0);
  const totalWritten = results.reduce((sum, r) => sum + r.written, 0);

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    usingMock,
    scraper_count: results.length,
    success_count: results.filter((r) => r.success).length,
    total_events: totalEvents,
    total_written: totalWritten,
    places: places
      ? { ran: true, place_count: places.placeCount, written: places.written, created: places.created, success: places.success, error: places.error }
      : { ran: false, note: "yalnız Pazartesi tetiklenir" },
    note: "Scrape sonuçları db.event'e yazıldı (Neon); sayfalar + public API bunları gösterir.",
    results: results.map((r) => ({
      source: r.source,
      success: r.success,
      event_count: r.eventCount,
      written: r.written,
      duration_ms: r.durationMs,
      error: r.error,
    })),
  });
}
