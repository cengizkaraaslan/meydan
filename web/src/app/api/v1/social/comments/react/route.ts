import { NextResponse, type NextRequest } from "next/server";
import { reactToPostComment } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// POST /api/v1/social/comments/react  body {commentId, deviceId, emoji}  (aynı emoji tekrar → kaldırır)
export async function POST(request: NextRequest) {
  let body: { commentId?: string; deviceId?: string; emoji?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const commentId = body.commentId?.trim();
  const deviceId = body.deviceId?.trim();
  const emoji = body.emoji?.trim();
  if (!commentId || !deviceId || !emoji) {
    return NextResponse.json({ error: "commentId/deviceId/emoji zorunlu" }, { status: 400 });
  }
  const res = await reactToPostComment({ commentId, deviceId, emoji });
  return NextResponse.json({ ok: true, ...res });
}
