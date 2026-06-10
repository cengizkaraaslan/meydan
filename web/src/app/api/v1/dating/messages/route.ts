import { NextResponse, type NextRequest } from "next/server";
import {
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  recipientDevicesForMatch,
  deviceDisplayName,
  type MutationReason,
} from "@/lib/mobile-chat-store";
import { extractMentionEmails, notifyDevices, notifyEmails, preview } from "@/lib/mention-notify";

// Backend foto mesajı öneki (chat.ts ile aynı) — bildirimde "📷 Fotoğraf" göster.
const IMG_PREFIX = "[img]";

export const dynamic = "force-dynamic";

interface MessageBody {
  matchKey?: string;
  senderDeviceId?: string;
  text?: string;
}

interface EditBody {
  id?: string;
  senderDeviceId?: string;
  text?: string;
}

interface DeleteBody {
  id?: string;
  senderDeviceId?: string;
}

// reason → HTTP kodu: forbidden=403, expired=409, notfound=404.
function statusForReason(reason: MutationReason | undefined): number {
  switch (reason) {
    case "forbidden":
      return 403;
    case "expired":
      return 409;
    case "notfound":
    default:
      return 404;
  }
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

// PATCH /api/v1/dating/messages — mesajı düzenle (sadece sahibi, 10 dk içinde).
export async function PATCH(request: NextRequest) {
  let body: EditBody;
  try {
    body = (await request.json()) as EditBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const senderDeviceId = body.senderDeviceId?.trim();
  const text = body.text?.trim();
  if (!id || !senderDeviceId || !text) {
    return NextResponse.json({ error: "id, senderDeviceId ve text zorunlu" }, { status: 400 });
  }
  const result = await editMessage({ id, senderDeviceId, text });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: statusForReason(result.reason) });
  }
  return NextResponse.json({ ok: true, message: result.message });
}

// DELETE /api/v1/dating/messages — mesajı sil (sadece sahibi, 10 dk içinde).
export async function DELETE(request: NextRequest) {
  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const senderDeviceId = body.senderDeviceId?.trim();
  if (!id || !senderDeviceId) {
    return NextResponse.json({ error: "id ve senderDeviceId zorunlu" }, { status: 400 });
  }
  const result = await deleteMessage({ id, senderDeviceId });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: statusForReason(result.reason) });
  }
  return NextResponse.json({ ok: true });
}
