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

// Backend medya mesajı önekleri (chat.ts ile aynı) — bildirimde okunur etiket göster.
const IMG_PREFIX = "[img]";
const VOICE_PREFIX = "[voice]";
// Tepki (reaction) öneki — bunlar mesaj değil, push bildirimi gönderilmez.
const REACT_PREFIX = "[react]";
// Yanıt öneki — bildirimde alıntı meta'sını değil yalnız gerçek metni göster.
const REPLY_PREFIX = "[reply]";
const REPLY_SEP = String.fromCharCode(1);
function replyInnerText(t: string): string {
  const parts = t.slice(REPLY_PREFIX.length).split(REPLY_SEP);
  return parts.length >= 4 ? parts.slice(3).join(REPLY_SEP) : t;
}

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
  // Sayfalama: limit (varsayılan 20) + before (epoch ms; eski sayfa için).
  const limit = Number(sp.get("limit")) || undefined;
  const before = Number(sp.get("before")) || undefined;
  // noReceipt=1 → "okundu bilgisini gizle" açık; karşı tarafa okundu (readAt) yazma.
  const skipRead = sp.get("noReceipt") === "1";
  const data = await listMessages({ matchKey, deviceId, limit, before, skipRead });
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

  // Alıcıya önizlemeli bildirim (Instagram tarzı) + @mention. Bot/sistem & tepki mesajını atla.
  if (!senderDeviceId.startsWith("bot_") && !text.startsWith(REACT_PREFIX)) {
    void (async () => {
      const recipients = await recipientDevicesForMatch(matchKey, senderDeviceId);
      const name = (await deviceDisplayName(senderDeviceId)) || "Biri";
      const shown = text.startsWith(REPLY_PREFIX) ? replyInnerText(text) : text;
      // Push başlığı: "Ahmet Yılmaz sana mesaj yolladı!" (foto/ses'te uygun fiil); gövde = önizleme.
      const action = shown.startsWith(IMG_PREFIX)
        ? "sana fotoğraf yolladı!"
        : shown.startsWith(VOICE_PREFIX)
          ? "sana sesli mesaj yolladı!"
          : "sana mesaj yolladı!";
      const bodyText = shown.startsWith(IMG_PREFIX)
        ? "📷 Fotoğraf"
        : shown.startsWith(VOICE_PREFIX)
          ? "🎤 Sesli mesaj"
          : preview(shown, 140);
      // partnerId = gönderen (alıcı için sohbet karşı tarafı). data.name → bildirimden sohbet başlığı (sadece ad).
      // url yok → mobil tip-bazlı (dm) yönlendirmeyle doğrudan /sohbet/[id] açılır; web fallback /mesajlar.
      const data = { type: "dm", matchKey, partnerId: senderDeviceId, name, url: "/mesajlar" };
      if (recipients.length) {
        await notifyDevices(recipients, { title: `${name} ${action}`, body: bodyText, data, inApp: { type: "dm", actorId: senderDeviceId, actorName: name } });
      }
      // DM içinde @email geçtiyse o kişilere de bildir (alıcıdan bağımsız).
      const emails = extractMentionEmails(text);
      if (emails.length) {
        await notifyEmails(emails, { title: `${name} senden bahsetti`, body: bodyText, data, inApp: { type: "mention", actorId: senderDeviceId, actorName: name } });
      }
    })().catch(() => {});
  }

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
