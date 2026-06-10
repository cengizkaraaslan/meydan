import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

interface MentionUser {
  email: string;
  name: string | null;
  avatar: string | null;
  /** Profile gitmek için kimlik (mobil kullanıcıda deviceId; yoksa web User.id). */
  id: string | null;
}

// GET /api/v1/mobile/mentionable-users?q=...
// @mention autocomplete kaynağı: email'i olan (= bildirilebilir) kullanıcılar.
// Mobil (MobileProfile) + web (User) birleştirilir, email'e göre tekilleştirilir.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!isDbConfigured) return NextResponse.json({ ok: true, data: [] });

  const like = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  try {
    const [profiles, users] = await Promise.all([
      db.mobileProfile.findMany({
        where: { email: { not: null }, ...like },
        select: { email: true, name: true, avatar: true, deviceId: true },
        take: 20,
      }),
      db.user.findMany({
        where: q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" as const } },
                { name: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {},
        select: { id: true, email: true, name: true, image: true },
        take: 20,
      }),
    ]);

    // email → en zengin kayıt (ad/avatar/id dolu olanı tercih et). Mobil deviceId önceliklidir.
    const byEmail = new Map<string, MentionUser>();
    const add = (email: string | null, name: string | null, avatar: string | null, id: string | null) => {
      const e = email?.trim().toLowerCase();
      if (!e) return;
      const existing = byEmail.get(e);
      if (!existing) {
        byEmail.set(e, { email: e, name: name ?? null, avatar: avatar ?? null, id: id ?? null });
      } else {
        if (!existing.name && name) existing.name = name;
        if (!existing.avatar && avatar) existing.avatar = avatar;
        if (!existing.id && id) existing.id = id;
      }
    };
    // Önce mobil profiller (deviceId = /kisi için doğru kimlik), sonra web User'lar.
    profiles.forEach((p) => add(p.email, p.name, p.avatar, p.deviceId));
    users.forEach((u) => add(u.email, u.name, u.image, u.id));

    const data = [...byEmail.values()]
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "tr"))
      .slice(0, 8);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, data: [], error: e instanceof Error ? e.message : "db" });
  }
}
