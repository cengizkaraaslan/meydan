import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { scraperRegistry } from "@/lib/scrapers/ScraperRegistry";
import { recordRun, persistRun } from "@/lib/scrapers/RunTracker";
import { setEventsForSource } from "@/lib/scrapers/EventCache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Scraper'ları senkron çalıştır + RunTracker'a kaydet (in-memory + kalıcı DB)
  const usingMock = process.env.USE_MOCK_DATA === "true";
  const results = await scraperRegistry.runAll();

  // Scrape sonuçlarını Neon'a yaz (db.event, source != MANUAL) — kalıcı + herkese görünür
  let totalWritten = 0;
  for (const r of results) {
    recordRun(r);
    const written = r.success && r.events.length > 0 ? await setEventsForSource(r.source, r.events) : 0;
    totalWritten += written;
    await persistRun(r, { created: written });
  }

  // TODO (#25 — bildirim): yeni etkinlik tespit edilince eşleşen cihazlara push gönder.
  //   İskele: setEventsForSource'tan yeni oluşturulan event'leri topla → her event için
  //   db.notifPref'te mode != "none" olan cihazları sorgula; mode "filtered" ise
  //   pref.cities / pref.categories (virgülle ayrık) ile event.city / event.category eşleşmesini
  //   kontrol et → eşleşen deviceId'lere push at. Gerçek push entegrasyonu (FCM/Expo/web-push)
  //   ayrı bir görev; push altyapısı bağlanınca buraya gönderim çağrısı eklenecek.

  // Sayfa cache'lerini invalid et
  revalidatePath("/");
  revalidatePath("/etkinlikler");
  revalidatePath("/etkinlik", "layout");

  const totalEvents = results.reduce((sum, r) => sum + r.events.length, 0);

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    usingMock,
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
