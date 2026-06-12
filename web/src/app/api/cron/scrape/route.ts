import { NextResponse, type NextRequest, after } from "next/server";
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

  // KENDİ KENDİNE ZİNCİRLEME: Hobby lambda'sı tek vCPU → 109 scraper'ın HTML'ini TEK 60sn'lik
  // çağrıda çekip parse etmek imkânsız (cheerio CPU-bound; tek invocation ~63/109 yetişip 504).
  // Çözüm: işi N parçaya böl, bu çağrı yalnız bu shard'ı işlesin; bitince after() ile BİR SONRAKİ
  // shard'ı AYRI bir lambda (kendi 60sn + vCPU'su) olarak tetikle. Vercel cron entry (paramsız)
  // = shard 0; oradan zincir 1..N-1 ilerler. Ekstra cron entry gerekmez (Hobby 2-cron limiti).
  const url = new URL(request.url);
  const shards = Number(url.searchParams.get("shards")) || Number(process.env.SCRAPE_SHARDS) || 8;
  const shard = Number(url.searchParams.get("shard")) || 0;
  const usingMock = process.env.USE_MOCK_DATA === "true";

  console.log(`[cron/scrape] shard ${shard}/${shards} başladı`);
  const results = await runAndPersistAll({ shard, shards });
  console.log(`[cron/scrape] shard ${shard}/${shards} bitti: ${results.length} kaynak, ${results.reduce((s, r) => s + r.written, 0)} yazıldı`);

  // Sıradaki shard'ı tetikle: ateşle-ve-bırak. İsteği başlat, ~3sn sonra abort et — istek
  // Vercel'e ulaşınca yeni lambda BAĞIMSIZ koşar (client abort sunucu invocation'ını iptal etmez).
  // Tam yanıtı BEKLEME: aksi halde shard0, shard1→2→3 zincirini await edip 60sn'de ölür ve kopar.
  if (shard + 1 < shards) {
    after(async () => {
      console.log(`[cron/scrape] shard ${shard + 1}/${shards} tetikleniyor`);
      try {
        await fetch(`${url.origin}/api/cron/scrape?shard=${shard + 1}&shards=${shards}`, {
          headers: secret ? { authorization: `Bearer ${secret}` } : {},
          // 8sn: soğuk başlatmada sonraki shard lambda'sı isteği alana dek yeterli süre tanı
          // (3sn cold start'tan kısaydı → istek iletilmeden iptal olup zincir kopuyordu).
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        /* abort beklenen — istek iletildi, shard bağımsız çalışır */
      }
    });
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
