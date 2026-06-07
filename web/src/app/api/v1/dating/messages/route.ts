import { NextResponse, type NextRequest } from "next/server";
import { listMessages, sendMessage } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

interface MessageBody {
  matchKey?: string;
  senderDeviceId?: string;
  text?: string;
}

// GET /api/v1/dating/messages?matchKey=...&deviceId=... — konuşma mesajları (karşıdakini okundu işaretler).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const matchKey = sp.get("matchKey")?.trim();
  const deviceId = sp.get("deviceId")?.trim();
  if (!matchKey || !deviceId) {
    return NextResponse.json({ error: "matchKey ve deviceId zorunlu" }, { status: 400 });
  }
  const data = await listMessages({ matchKey, deviceId });
  return NextResponse.json({ ok: true, data });
}

// POST /api/v1/dating/messages — mesaj gönder. (Bot cevabı için senderDeviceId = partnerId verilir.)
export async function POST(request: NextRequest) {
  let body: MessageBody;
  try {
    body = (await request.json()) as MessageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const matchKey = body.matchKey?.trim();
  const senderDeviceId = body.senderDeviceId?.trim();
  const text = body.text?.trim();
  if (!matchKey || !senderDeviceId || !text) {
    return NextResponse.json({ error: "matchKey, senderDeviceId ve text zorunlu" }, { status: 400 });
  }
  const message = await sendMessage({ matchKey, senderDeviceId, text });
  return NextResponse.json({ ok: true, message });
}
