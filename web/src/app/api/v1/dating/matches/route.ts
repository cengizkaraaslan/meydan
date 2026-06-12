import { NextResponse, type NextRequest } from "next/server";
import { ensureMatch, listMatches, deleteMatch, markAllRead, markMatchRead } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

interface MatchBody {
  deviceId?: string;
  partnerId?: string;
  partnerName?: string | null;
  partnerAvatar?: string | null;
}

interface DeleteMatchBody {
  deviceId?: string;
  matchKey?: string;
}

interface ReadAllBody {
  deviceId?: string;
  matchKey?: string; // verilirse YALNIZ o sohbeti okundu işaretle; yoksa tümünü
}

// GET /api/v1/dating/matches?deviceId=... — cihazın eşleşmeleri (son mesaj + okunmamış sayısı).
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  }
  const data = await listMatches(deviceId);
  return NextResponse.json({ ok: true, data });
}

// POST /api/v1/dating/matches — (mock/demo) eşleşme konuşması oluştur (idempotent).
export async function POST(request: NextRequest) {
  let body: MatchBody;
  try {
    body = (await request.json()) as MatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  const partnerId = body.partnerId?.trim();
  if (!deviceId || !partnerId) {
    return NextResponse.json({ error: "deviceId ve partnerId zorunlu" }, { status: 400 });
  }
  const result = await ensureMatch({
    deviceId,
    partnerId,
    partnerName: body.partnerName ?? null,
    partnerAvatar: body.partnerAvatar ?? null,
  });
  return NextResponse.json({ ok: true, ...result });
}

// DELETE /api/v1/dating/matches — bir konuşmayı bu cihazın listesinden sil.
export async function DELETE(request: NextRequest) {
  let body: DeleteMatchBody;
  try {
    body = (await request.json()) as DeleteMatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  const matchKey = body.matchKey?.trim();
  if (!deviceId || !matchKey) {
    return NextResponse.json({ error: "deviceId ve matchKey zorunlu" }, { status: 400 });
  }
  const result = await deleteMatch({ deviceId, matchKey });
  return NextResponse.json(result);
}

// PATCH /api/v1/dating/matches — cihazın tüm sohbetlerini okundu işaretle (rozeti sıfırlar).
export async function PATCH(request: NextRequest) {
  let body: ReadAllBody;
  try {
    body = (await request.json()) as ReadAllBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = body.deviceId?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  }
  const matchKey = body.matchKey?.trim();
  const result = matchKey ? await markMatchRead(deviceId, matchKey) : await markAllRead(deviceId);
  return NextResponse.json(result);
}
