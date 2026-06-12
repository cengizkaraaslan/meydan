import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type { EventSource } from "@/lib/types";
import { scraperRegistry } from "@/lib/scrapers/ScraperRegistry";
import { recordRun, persistRun, getLatestRunPerSourceFromDb } from "@/lib/scrapers/RunTracker";
import { setEventsForSource } from "@/lib/scrapers/EventCache";
import { runAndPersistAll, type SourceRunSummary } from "@/lib/scrapers/runAndPersist";
import { isAdminEmail } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/v1/admin/scrapers?email=<adminEmail>
 * Kayıtlı tüm scraper'lar (bot) + her birinin DB'deki en son çalışması.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!(await isAdminEmail(email))) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const latest = await getLatestRunPerSourceFromDb();
  const scrapers = scraperRegistry
    .list()
    .map((s) => {
      const run = latest.get(String(s.source));
      return {
        source: String(s.source),
        label: s.displayName,
        lastRun: run
          ? {
              startedAt: run.startedAt.toISOString(),
              finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
              durationMs: run.durationMs,
              success: run.success,
              itemsFound: run.itemsFound,
              itemsCreated: run.itemsCreated,
              itemsUpdated: run.itemsUpdated,
              errorMessage: run.errorMessage,
            }
          : null,
      };
    })
    .sort((a, b) => {
      // Hiç çalışmamışlar sona; çalışanlar en yeni en üstte.
      const ta = a.lastRun ? Date.parse(a.lastRun.startedAt) : 0;
      const tb = b.lastRun ? Date.parse(b.lastRun.startedAt) : 0;
      return tb - ta;
    });

  return NextResponse.json({ ok: true, count: scrapers.length, scrapers });
}

interface TriggerBody {
  email?: string;
  source?: string; // verilirse tek bot; yoksa hepsi
}

/**
 * POST /api/v1/admin/scrapers — botları tetikler (tek source ya da hepsi).
 * Sonuçları Neon'a yazar, cache'leri tazeler, kaynak-bazlı özet döner.
 */
export async function POST(request: NextRequest) {
  let body: TriggerBody;
  try {
    body = (await request.json()) as TriggerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!(await isAdminEmail(body.email))) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let summaries: SourceRunSummary[];
  if (body.source) {
    // Tek kaynak: tek fetch + tek persist (darboğaz yok), eski davranış.
    const r = await scraperRegistry.runOne(body.source as EventSource);
    if (!r) {
      return NextResponse.json({ error: "Bilinmeyen scraper" }, { status: 404 });
    }
    recordRun(r);
    const written = r.success && r.events.length > 0 ? await setEventsForSource(r.source, r.events) : 0;
    await persistRun(r, { created: written });
    summaries = [{
      source: String(r.source),
      success: r.success,
      eventCount: r.events.length,
      written,
      durationMs: r.finishedAt.getTime() - r.startedAt.getTime(),
      error: r.errorMessage,
    }];
  } else {
    // Hepsi: cron/admin ile AYNI helper — fetch'ler paralel, persist sınırlı havuzdan
    // (eski sıralı persist döngüsü 60sn'yi aşıp çoğu kaynağı yazamıyordu).
    summaries = await runAndPersistAll();
  }

  revalidatePath("/");
  revalidatePath("/etkinlikler");

  const totalWritten = summaries.reduce((sum, r) => sum + r.written, 0);
  const summary = summaries
    .map((r) => ({
      source: r.source,
      success: r.success,
      itemsFound: r.eventCount,
      durationMs: r.durationMs,
      error: r.error ?? null,
    }))
    .sort((a, b) => b.itemsFound - a.itemsFound);

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    scraperCount: summaries.length,
    successCount: summaries.filter((r) => r.success).length,
    totalWritten,
    results: summary,
  });
}
