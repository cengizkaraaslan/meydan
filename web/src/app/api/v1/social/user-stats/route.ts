import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/v1/social/user-stats?deviceId=...
// Bir kullanıcının GERÇEK toplam sayıları (mock değil) — profil ekranı için.
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });

  const empty = { attended: 0, comments: 0, photos: 0, stories: 0, following: 0, followers: 0, reactions: 0 };
  if (!isDbConfigured) return NextResponse.json({ ok: true, stats: empty });

  try {
    const [attended, comments, photos, stories, following, followers, reactions] = await Promise.all([
      db.eventAttendance.count({ where: { deviceId } }),
      db.eventCommentMobile.count({ where: { deviceId } }),
      db.eventPhotoMobile.count({ where: { deviceId } }),
      db.mobileStory.count({ where: { deviceId } }),
      db.follow.count({ where: { followerDeviceId: deviceId } }),
      db.follow.count({ where: { followingId: deviceId } }),
      db.postReaction.count({ where: { deviceId } }),
    ]);
    return NextResponse.json({ ok: true, stats: { attended, comments, photos, stories, following, followers, reactions } });
  } catch (e) {
    return NextResponse.json({ ok: false, stats: empty, error: e instanceof Error ? e.message : "db" });
  }
}
