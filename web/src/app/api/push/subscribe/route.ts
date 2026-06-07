import { NextResponse, type NextRequest } from "next/server";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { saveSubscription } from "@/lib/push-server";
import type { EventCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SubscribeBody {
  subscription?: WebPushSubscription;
  categories?: EventCategory[];
}

export async function POST(request: NextRequest) {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscription, categories = [] } = body;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "Geçersiz subscription" }, { status: 400 });
  }

  const record = await saveSubscription(subscription, categories);
  return NextResponse.json({
    ok: true,
    userId: record.userId,
    categories: record.categories,
  });
}
