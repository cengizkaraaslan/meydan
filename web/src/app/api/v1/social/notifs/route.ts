import { NextResponse, type NextRequest } from "next/server";
import { listNotifs, markNotifsRead } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// GET /api/v1/social/notifs?deviceId=...
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  const data = await listNotifs(deviceId);
  const unread = data.filter((n) => !n.read).length;
  return NextResponse.json({ ok: true, data, unread });
}

// POST /api/v1/social/notifs  body {deviceId}  → hepsini okundu işaretle
export async function POST(request: NextRequest) {
  let body: { deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  const res = await markNotifsRead(deviceId);
  return NextResponse.json(res);
}
