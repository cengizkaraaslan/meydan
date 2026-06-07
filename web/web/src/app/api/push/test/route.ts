import { NextResponse, type NextRequest } from "next/server";
import { sendPush, getSubscriberCount } from "@/lib/push-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== "production";

  // Dev'de açık, prod'da CRON_SECRET şart
  if (!isDev && secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await sendPush(null, {
    title: "EtkinlikScout — Test",
    body: "Bildirimler çalışıyor. Yeni etkinlikler artık burada görünecek.",
    url: "/etkinlikler",
  });

  const subscriberCount = await getSubscriberCount();

  return NextResponse.json({
    sent_at: new Date().toISOString(),
    subscriber_count: subscriberCount,
    delivered: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
