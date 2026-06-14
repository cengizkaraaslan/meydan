import { NextResponse, type NextRequest } from "next/server";
import { recipientDevicesForMatch, deviceDisplayName, deviceAvatar } from "@/lib/mobile-chat-store";
import { notifyDevices } from "@/lib/mention-notify";

export const dynamic = "force-dynamic";

/**
 * Sesli arama "çaldır" — arayan, eşleştiği kişiyi çağırınca bu endpoint callee cihaz(lar)ına
 * yüksek öncelikli Expo push (data.kind="call-ring") atar. Mobil CallProvider bu push'u hangi
 * ekranda olursa olsun yakalayıp gelen arama UI'ı gösterir. (SDP/ICE ayrıca sohbet kanalından akar.)
 */
export async function POST(req: NextRequest) {
  let body: { matchKey?: string; fromDeviceId?: string; toId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { matchKey, fromDeviceId } = body;
  if (!matchKey || !fromDeviceId) {
    return NextResponse.json({ error: "matchKey ve fromDeviceId zorunlu" }, { status: 400 });
  }

  const recipients = await recipientDevicesForMatch(matchKey, fromDeviceId);
  if (!recipients.length) return NextResponse.json({ ok: true, ringed: 0 });

  const [name, avatar] = await Promise.all([
    deviceDisplayName(fromDeviceId).then((n) => n || "Biri"),
    deviceAvatar(fromDeviceId),
  ]);
  const data = { kind: "call-ring", matchKey, fromId: fromDeviceId, fromName: name, fromAvatar: avatar ?? "" };
  await notifyDevices(recipients, {
    title: "📞 Sesli arama",
    body: `${name} seni arıyor…`,
    data,
    image: avatar ?? undefined,
    inApp: { type: "dm", actorId: fromDeviceId, actorName: name },
  });
  return NextResponse.json({ ok: true, ringed: recipients.length });
}
