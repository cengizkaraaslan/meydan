import { NextResponse, type NextRequest } from "next/server";
import { follow, unfollow, listFollowingIds } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// GET /api/v1/social/follow?deviceId=...  → takip edilen id listesi
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  const ids = await listFollowingIds(deviceId);
  return NextResponse.json({ ok: true, following: ids });
}

// POST /api/v1/social/follow  body {followerDeviceId, followingId, actorName?}
export async function POST(request: NextRequest) {
  let body: { followerDeviceId?: string; followingId?: string; actorName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const followerDeviceId = body.followerDeviceId?.trim();
  const followingId = body.followingId?.trim();
  if (!followerDeviceId || !followingId) return NextResponse.json({ error: "followerDeviceId/followingId zorunlu" }, { status: 400 });
  const res = await follow({ followerDeviceId, followingId, actorName: body.actorName ?? null });
  return NextResponse.json({ ok: true, ...res });
}

// DELETE /api/v1/social/follow  body {followerDeviceId, followingId}
export async function DELETE(request: NextRequest) {
  let body: { followerDeviceId?: string; followingId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const followerDeviceId = body.followerDeviceId?.trim();
  const followingId = body.followingId?.trim();
  if (!followerDeviceId || !followingId) return NextResponse.json({ error: "followerDeviceId/followingId zorunlu" }, { status: 400 });
  const res = await unfollow({ followerDeviceId, followingId });
  return NextResponse.json({ ok: true, ...res });
}
