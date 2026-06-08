import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

// Mobil admin = uygulamadaki ADMIN_EMAIL ile aynı (lib/admin.ts).
const ADMIN_EMAILS = new Set(["cengiz7karaaslan@gmail.com"]);

function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.trim().toLowerCase());
}

/**
 * GET /api/v1/admin/users?email=<adminEmail>
 * Yönetim paneli (mobil) için kullanıcılar:
 *  - "real": Google ile giren gerçek hesaplar (User tablosu)
 *  - "device": cihaz bazlı anonim profiller (MobileProfile) + favori/beğeni/katılım sayıları
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!isDbConfigured) {
    return NextResponse.json({ ok: true, realCount: 0, deviceCount: 0, users: [] });
  }

  try {
    const [users, profiles, favGroups, swipeGroups, attGroups] = await Promise.all([
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, image: true, role: true, createdAt: true, updatedAt: true },
      }),
      db.mobileProfile.findMany({ orderBy: { createdAt: "desc" } }),
      db.favorite.groupBy({ by: ["deviceId"], _count: { _all: true } }),
      db.swipe.groupBy({ by: ["swiperDeviceId"], _count: { _all: true } }),
      db.eventAttendance.groupBy({ by: ["deviceId"], _count: { _all: true } }),
    ]);

    const favBy = new Map(favGroups.map((g) => [g.deviceId, g._count._all]));
    const swipeBy = new Map(swipeGroups.map((g) => [g.swiperDeviceId, g._count._all]));
    const attBy = new Map(attGroups.map((g) => [g.deviceId, g._count._all]));

    const realUsers = users.map((u) => ({
      type: "real" as const,
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    const deviceUsers = profiles.map((p) => ({
      type: "device" as const,
      id: p.deviceId,
      deviceId: p.deviceId,
      name: p.name ?? null,
      isFake: p.isFake,
      city: p.city,
      district: p.district,
      gender: p.gender,
      avatar: p.avatar,
      isAdmin: p.isAdmin,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      favorites: favBy.get(p.deviceId) ?? 0,
      likes: swipeBy.get(p.deviceId) ?? 0,
      attendances: attBy.get(p.deviceId) ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      realCount: realUsers.length,
      deviceCount: deviceUsers.filter((d) => !d.isFake).length,
      fakeCount: deviceUsers.filter((d) => d.isFake).length,
      users: [...realUsers, ...deviceUsers],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB hatası" }, { status: 500 });
  }
}
