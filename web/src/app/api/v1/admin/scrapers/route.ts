import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type { EventSource } from "@/lib/types";
import { scraperRegistry } from "@/lib/scrapers/ScraperRegistry";
import { recordRun, persistRun, getLatestRunPerSourceFromDb } from "@/lib/scrapers/RunTracker";
import { setEventsForSource } from "@/lib/scrapers/EventCache";
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

  const results = body.source
    ? [await scraperRegistry.runOne(body.source as EventSource)].filter((r): r is NonNullable<typeof r> => !!r)
    : await scraperRegistry.runAll();

  if (body.source && results.length === 0) {
    return NextResponse.json({ error: "Bilinmeyen scraper" }, { status: 404 });
  }

  let totalWritten = 0;
  for (const r of results) {
    recordRun(r);
    const written = r.success && r.events.length > 0 ? await setEventsForSource(r.source, r.events) : 0;
    totalWritten += written;
    await persistRun(r, { created: written });
  }

  revalidatePath("/");
  revalidatePath("/etkinlikler");

  const summary = results
    .map((r) => ({
      source: String(r.source),
      success: r.success,
      itemsFound: r.events.length,
      durationMs: r.finishedAt.getTime() - r.startedAt.getTime(),
      error: r.errorMessage ?? null,
    }))
    .sort((a, b) => b.itemsFound - a.itemsFound);

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    scraperCount: results.length,
    successCount: results.filter((r) => r.success).length,
    totalWritten,
    results: summary,
  });
}
