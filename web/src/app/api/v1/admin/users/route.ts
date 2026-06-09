import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { isAdminEmail, isFounderEmail } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/users?email=<adminEmail>
 * Yönetim paneli (mobil) için kullanıcılar:
 *  - "real": Google ile giren gerçek hesaplar (User tablosu)
 *  - "device": cihaz bazlı anonim profiller (MobileProfile) + favori/beğeni/katılım sayıları
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!(await isAdminEmail(email))) {
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

/**
 * PATCH /api/v1/admin/users
 * Body: { email: <adminEmail>, userId: string, role: "ADMIN" | "USER" }
 * Bir GERÇEK (User) kullanıcının rolünü değiştirir → admin yap / adminliği kaldır.
 */
export async function PATCH(request: NextRequest) {
  let body: { email?: string; userId?: string; role?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  if (!(await isAdminEmail(body.email))) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!isDbConfigured) {
    return NextResponse.json({ error: "Veritabanı yapılandırılmamış" }, { status: 503 });
  }
  const { userId, role } = body;
  if (!userId || (role !== "ADMIN" && role !== "USER")) {
    return NextResponse.json({ error: "userId ve role (ADMIN|USER) zorunlu" }, { status: 400 });
  }

  try {
    const target = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!target) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }
    // Kurucu adminin rolü panelden düşürülemez (zaten whitelist ile admin kalır → kafa karıştırmasın).
    if (role === "USER" && isFounderEmail(target.email)) {
      return NextResponse.json({ error: "Kurucu adminin rolü değiştirilemez" }, { status: 400 });
    }
    const updated = await db.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB hatası" }, { status: 500 });
  }
}
