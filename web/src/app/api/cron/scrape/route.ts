import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { runAndPersistAll } from "@/lib/scrapers/runAndPersist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tek invocation: tüm scraper'lar run()+persist tek bounded havuzdan (fetch & persist örtüşür),
  // 60sn'ye sığar. Opsiyonel ?shard=i&shards=N ile elle parça çalıştırılabilir (vars. hepsi).
  const url = new URL(request.url);
  const shards = Number(url.searchParams.get("shards")) || 1;
  const shard = Number(url.searchParams.get("shard")) || 0;
  const usingMock = process.env.USE_MOCK_DATA === "true";

  const results = await runAndPersistAll({ shard, shards });

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

  const totalEvents = results.reduce((sum, r) => sum + r.eventCount, 0);
  const totalWritten = results.reduce((sum, r) => sum + r.written, 0);

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    usingMock,
    mode: shards > 1 ? `shard ${shard}/${shards}` : "all",
    scraper_count: results.length,
    success_count: results.filter((r) => r.success).length,
    total_events: totalEvents,
    total_written: totalWritten,
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
