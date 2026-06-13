import { NextResponse, type NextRequest } from "next/server";
import { blockUser } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

// POST /api/v1/dating/block  body {deviceId, targetId} — deviceId, targetId'yi engeller.
export async function POST(request: NextRequest) {
  let body: { deviceId?: string; targetId?: string };
  try {
    body = (await request.json()) as { deviceId?: string; targetId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  const targetId = body.targetId?.trim();
  if (!deviceId || !targetId) {
    return NextResponse.json({ error: "deviceId ve targetId zorunlu" }, { status: 400 });
  }
  const r = await blockUser(deviceId, targetId);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
