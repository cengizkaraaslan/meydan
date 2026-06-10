import { NextResponse, type NextRequest } from "next/server";
import { markMobileStoryViewed, listMobileStoryViewers } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// GET /api/v1/social/stories/views?storyId=X → { ok, count, viewers } (story sahibi için)
export async function GET(request: NextRequest) {
  const storyId = request.nextUrl.searchParams.get("storyId")?.trim();
  if (!storyId) return NextResponse.json({ error: "storyId zorunlu" }, { status: 400 });
  const { count, viewers } = await listMobileStoryViewers(storyId);
  return NextResponse.json({ ok: true, count, viewers });
}

// POST /api/v1/social/stories/views  { storyId, viewerId }  → görüntülenmeyi kaydet
export async function POST(request: NextRequest) {
  let body: { storyId?: string; viewerId?: string };
  try {
    body = (await request.json()) as { storyId?: string; viewerId?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz gövde" }, { status: 400 });
  }
  const storyId = body.storyId?.trim();
  const viewerId = body.viewerId?.trim();
  if (!storyId || !viewerId) return NextResponse.json({ error: "storyId/viewerId zorunlu" }, { status: 400 });
  const r = await markMobileStoryViewed(storyId, viewerId);
  return NextResponse.json(r);
}
