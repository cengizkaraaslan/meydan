import { NextResponse, type NextRequest } from "next/server";
import { listComments, addComment } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// GET /api/v1/social/comments?postId=...
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId")?.trim();
  if (!postId) return NextResponse.json({ error: "postId zorunlu" }, { status: 400 });
  const data = await listComments(postId);
  return NextResponse.json({ ok: true, data });
}

// POST /api/v1/social/comments  body {postId, deviceId, authorName?, text}
export async function POST(request: NextRequest) {
  let body: { postId?: string; deviceId?: string; authorName?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const postId = body.postId?.trim();
  const deviceId = body.deviceId?.trim();
  const text = body.text?.trim();
  if (!postId || !deviceId || !text) return NextResponse.json({ error: "postId/deviceId/text zorunlu" }, { status: 400 });
  const comment = await addComment({ postId, deviceId, authorName: body.authorName ?? null, text });
  return NextResponse.json({ ok: true, comment });
}
