import { NextResponse, type NextRequest } from "next/server";
import { setPresence, getPresence } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

// POST /api/v1/dating/presence  body {deviceId} — "şu an aktifim" kalp atışı (best-effort).
export async function POST(request: NextRequest) {
  let body: { deviceId?: string };
  try {
    body = (await request.json()) as { deviceId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  setPresence(deviceId);
  return NextResponse.json({ ok: true });
}

// GET /api/v1/dating/presence?deviceId=... — o cihazın çevrimiçi durumu + son görülme.
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  return NextResponse.json({ ok: true, ...getPresence(deviceId) });
}
