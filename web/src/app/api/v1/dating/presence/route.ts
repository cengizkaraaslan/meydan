import { NextResponse, type NextRequest } from "next/server";
import { setPresence, getPresence } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

// POST /api/v1/dating/presence  body {deviceId, hidden?} — "şu an aktifim" kalp atışı.
// hidden=true → "son görülme/çevrimiçi gizle" açık; karşı taraf durumu göremez.
export async function POST(request: NextRequest) {
  let body: { deviceId?: string; hidden?: boolean };
  try {
    body = (await request.json()) as { deviceId?: string; hidden?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  await setPresence(deviceId, body.hidden === true);
  return NextResponse.json({ ok: true });
}

// GET /api/v1/dating/presence?deviceId=... — o cihazın çevrimiçi durumu + son görülme.
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await getPresence(deviceId)) });
}
