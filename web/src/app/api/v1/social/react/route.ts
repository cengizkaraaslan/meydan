import { NextResponse, type NextRequest } from "next/server";
import { reactToPost } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// POST /api/v1/social/react  body {postId, deviceId, emoji}  (aynı emoji tekrar → kaldırır)
export async function POST(request: NextRequest) {
  let body: { postId?: string; deviceId?: string; emoji?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const postId = body.postId?.trim();
  const deviceId = body.deviceId?.trim();
  const emoji = body.emoji?.trim();
  if (!postId || !deviceId || !emoji) return NextResponse.json({ error: "postId/deviceId/emoji zorunlu" }, { status: 400 });
  const res = await reactToPost({ postId, deviceId, emoji });
  return NextResponse.json({ ok: true, ...res });
}
