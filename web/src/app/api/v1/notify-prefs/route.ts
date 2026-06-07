import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_MODES = ["all", "none", "filtered"] as const;
type Mode = (typeof VALID_MODES)[number];

function normalizeMode(value: unknown): Mode {
  const low = String(value ?? "").toLowerCase();
  return (VALID_MODES as readonly string[]).includes(low) ? (low as Mode) : "all";
}

function requireApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("api_key");
  if (process.env.NODE_ENV === "production" && !apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Send 'X-Api-Key' header or 'api_key' query param." },
      { status: 401 },
    );
  }
  return null;
}

// Array | virgülle-ayrık-string | null → temizlenmiş virgülle-ayrık string (boşsa null).
function toCsv(value: unknown): string | null {
  let parts: string[];
  if (Array.isArray(value)) {
    parts = value.map((v) => String(v));
  } else if (typeof value === "string") {
    parts = value.split(",");
  } else {
    return null;
  }
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(",") : null;
}

interface NotifPrefBody {
  deviceId?: string;
  mode?: string;
  cities?: string[] | string;
  categories?: string[] | string;
}

// POST /api/v1/notify-prefs  body {deviceId, mode, cities[], categories[]} → upsert
export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  if (!isDbConfigured) {
    return NextResponse.json({ ok: false });
  }

  let body: NotifPrefBody;
  try {
    body = (await request.json()) as NotifPrefBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = body.deviceId?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  }

  const mode = normalizeMode(body.mode);
  const cities = toCsv(body.cities);
  const categories = toCsv(body.categories);

  const pref = await db.notifPref.upsert({
    where: { deviceId },
    create: { deviceId, mode, cities, categories },
    update: { mode, cities, categories },
  });

  return NextResponse.json({ ok: true, pref });
}

// GET /api/v1/notify-prefs?deviceId=... → cihazın bildirim tercihi
export async function GET(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  if (!isDbConfigured) {
    return NextResponse.json({ ok: false });
  }

  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  }

  const pref = await db.notifPref.findUnique({ where: { deviceId } });
  return NextResponse.json({ ok: true, pref });
}
