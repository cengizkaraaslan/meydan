import { NextResponse, type NextRequest } from "next/server";
import { removeSubscription } from "@/lib/push-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { endpoint?: string };
  try {
    body = (await request.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint zorunlu" }, { status: 400 });
  }

  const removed = await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true, removed });
}
