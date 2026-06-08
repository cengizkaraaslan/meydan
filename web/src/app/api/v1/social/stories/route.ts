import { NextResponse, type NextRequest } from "next/server";
import { listMobileStories, createMobileStory, deleteMobileStory } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// GET /api/v1/social/stories?deviceId=...   veya   ?ids=a,b,c  → story listesi
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const ids = sp.get("ids");
  const deviceId = sp.get("deviceId")?.trim();
  const list = ids ? ids.split(",").map((s) => s.trim()).filter(Boolean) : deviceId ? [deviceId] : [];
  if (list.length === 0) return NextResponse.json({ error: "deviceId veya ids zorunlu" }, { status: 400 });
  const data = await listMobileStories(list);
  return NextResponse.json({ ok: true, data });
}

// POST /api/v1/social/stories  {deviceId, imageUrl, caption?, eventSlug?, eventTitle?, name?, avatar?}
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!deviceId || !imageUrl) return NextResponse.json({ error: "deviceId/imageUrl zorunlu" }, { status: 400 });
  const story = await createMobileStory({
    deviceId,
    imageUrl,
    caption: (body.caption as string) ?? null,
    eventSlug: (body.eventSlug as string) ?? null,
    eventTitle: (body.eventTitle as string) ?? null,
    name: (body.name as string) ?? null,
    avatar: (body.avatar as string) ?? null,
  });
  return NextResponse.json({ ok: true, story });
}

// DELETE /api/v1/social/stories  {id, deviceId}
export async function DELETE(request: NextRequest) {
  let body: { id?: string; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const deviceId = body.deviceId?.trim();
  if (!id || !deviceId) return NextResponse.json({ error: "id/deviceId zorunlu" }, { status: 400 });
  const res = await deleteMobileStory({ id, deviceId });
  return NextResponse.json(res, { status: res.ok ? 200 : 403 });
}
