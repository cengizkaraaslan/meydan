import { NextResponse, type NextRequest } from "next/server";
import { setTyping, isPartnerTyping } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

interface TypingBody {
  matchKey?: string;
  deviceId?: string;
}

// POST /api/v1/dating/typing — bu cihazın bir sohbette "yazıyor" olduğunu bildir (TTL ~6sn).
export async function POST(request: NextRequest) {
  let body: TypingBody;
  try {
    body = (await request.json()) as TypingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const matchKey = body.matchKey?.trim();
  const deviceId = body.deviceId?.trim();
  if (!matchKey || !deviceId) {
    return NextResponse.json({ error: "matchKey ve deviceId zorunlu" }, { status: 400 });
  }
  setTyping(matchKey, deviceId);
  return NextResponse.json({ ok: true });
}

// GET /api/v1/dating/typing?matchKey=...&deviceId=... — karşı taraf yazıyor mu?
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const matchKey = sp.get("matchKey")?.trim();
  const deviceId = sp.get("deviceId")?.trim();
  if (!matchKey || !deviceId) {
    return NextResponse.json({ error: "matchKey ve deviceId zorunlu" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, typing: isPartnerTyping(matchKey, deviceId) });
}
