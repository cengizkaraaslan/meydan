import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/v1/mobile/push-token  body {deviceId, token?, email?}
// Mobil cihazın Expo push token'ını (+ girişliyse email'ini) MobileProfile'a yazar.
// token null gönderilirse (izin iptali / çıkış) token temizlenir.
export async function POST(request: NextRequest) {
  let body: { deviceId?: string; token?: string | null; email?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  const token = typeof body.token === "string" ? body.token.trim() || null : null;
  const email = body.email?.trim().toLowerCase() || null;
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  if (!isDbConfigured) return NextResponse.json({ ok: true, stored: false });

  try {
    await db.mobileProfile.upsert({
      where: { deviceId },
      // email'i yalnızca geldiğinde yaz → token-only güncellemede mevcut email silinmesin.
      create: { deviceId, pushToken: token, email },
      update: { pushToken: token, ...(email ? { email } : {}) },
    });
    return NextResponse.json({ ok: true, stored: true });
  } catch (e) {
    // DB hatası bildirim akışını bozmasın — 200 ile sessiz başarısızlık.
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "db" });
  }
}
