import { NextResponse, after } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin panelinden "Tüm verileri çek" butonu bunu tetikler.
 * 109 scraper tek 60sn'lik lambda'ya sığmadığı için (Hobby tek vCPU) doğrudan çalıştırmaz;
 * cron'un KENDİ KENDİNE ZİNCİRLENEN scrape akışını (/api/cron/scrape, 4 parça) arka planda
 * tetikler ve hemen döner. Veriler ~2 dk içinde Neon'a yazılır (sayfa cache'lerini cron tazeler).
 */
export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Giriş yapmalısın" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const secret = process.env.CRON_SECRET;
  after(async () => {
    try {
      await fetch(`${origin}/api/cron/scrape`, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
      });
    } catch (err) {
      console.warn("[admin/scrape] zincir tetikleme hatası:", err instanceof Error ? err.message : err);
    }
  });

  return NextResponse.json({
    ok: true,
    started: true,
    note: "Scrape zinciri başlatıldı (parçalı). Tüm kaynaklar ~2 dk içinde Neon'a yazılır.",
  });
}
