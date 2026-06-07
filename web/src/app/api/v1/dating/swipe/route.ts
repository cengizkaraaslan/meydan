import { NextResponse, type NextRequest } from "next/server";
import { recordSwipe } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

interface SwipeBody {
  deviceId?: string;
  targetId?: string;
  targetName?: string | null;
  targetAvatar?: string | null;
  liked?: boolean;
}

// POST /api/v1/dating/swipe — beğen/geç kaydet; karşılıklı gerçek beğenide eşleştir.
export async function POST(request: NextRequest) {
  let body: SwipeBody;
  try {
    body = (await request.json()) as SwipeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = body.deviceId?.trim();
  const targetId = body.targetId?.trim();
  if (!deviceId || !targetId) {
    return NextResponse.json({ error: "deviceId ve targetId zorunlu" }, { status: 400 });
  }

  const result = await recordSwipe({
    deviceId,
    targetId,
    targetName: body.targetName ?? null,
    targetAvatar: body.targetAvatar ?? null,
    liked: Boolean(body.liked),
  });
  return NextResponse.json({ ok: true, ...result });
}
