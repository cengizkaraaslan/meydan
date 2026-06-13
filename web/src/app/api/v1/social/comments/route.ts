import { NextResponse, type NextRequest } from "next/server";
import { listComments, addComment, postCommentReplyTargetOwner } from "@/lib/social-store";
import { extractMentionEmails, notifyEmails, notifyDevices, preview } from "@/lib/mention-notify";
import { deviceDisplayName } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

// GET /api/v1/social/comments?postId=...&deviceId=...
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId")?.trim();
  if (!postId) return NextResponse.json({ error: "postId zorunlu" }, { status: 400 });
  const viewerDeviceId = request.nextUrl.searchParams.get("deviceId")?.trim() || "";
  const data = await listComments(postId, viewerDeviceId);
  return NextResponse.json({ ok: true, data });
}

// POST /api/v1/social/comments  body {postId, deviceId, authorName?, text, replyToId?}
export async function POST(request: NextRequest) {
  let body: { postId?: string; deviceId?: string; authorName?: string; text?: string; replyToId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const postId = body.postId?.trim();
  const deviceId = body.deviceId?.trim();
  const text = body.text?.trim();
  if (!postId || !deviceId || !text) return NextResponse.json({ error: "postId/deviceId/text zorunlu" }, { status: 400 });
  // İsim boş/yanlış gelirse (eski mobil sürüm adı geçirmiyordu → "Meydanlı") cihazdan çöz.
  let resolvedName = body.authorName?.trim() || null;
  if (!resolvedName || resolvedName === "Meydanlı") {
    resolvedName = (await deviceDisplayName(deviceId)) || resolvedName;
  }
  const who = resolvedName || "Biri";
  const replyToId = body.replyToId?.trim() || null;
  const comment = await addComment({ postId, deviceId, authorName: resolvedName, text, replyToId });

  // @mention → bahsedilen email'lere bildirim (Meydan duvarına yönlendir).
  const emails = extractMentionEmails(text);
  if (emails.length) {
    void notifyEmails(emails, {
      title: `${who} bir yorumda senden bahsetti`,
      body: preview(text),
      // Meydan duvarına git ve bahsedildiğin gönderinin yorumlarını aç.
      data: { type: "feed_comment", postId, url: `/meydan?post=${postId}` },
      inApp: { type: "feed_comment", actorId: deviceId, actorName: who },
    }).catch(() => {});
  }

  // Yanıt → yanıtlanan yorumun sahibine bildirim (kendine yanıt verirse atlanır).
  if (replyToId) {
    void (async () => {
      const owner = await postCommentReplyTargetOwner(replyToId);
      if (owner && owner !== deviceId) {
        await notifyDevices([owner], {
          title: `${who} yorumuna yanıt verdi`,
          body: preview(text),
          data: { type: "feed_comment", postId, url: `/meydan?post=${postId}` },
          inApp: { type: "feed_comment", actorId: deviceId, actorName: who },
        });
      }
    })().catch(() => {});
  }

  return NextResponse.json({ ok: true, comment });
}
