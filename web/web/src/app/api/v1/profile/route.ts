import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
type Gender = (typeof VALID_GENDERS)[number];

function normalizeGender(value: unknown): Gender | null {
  if (value == null) return null;
  const up = String(value).toUpperCase();
  return (VALID_GENDERS as readonly string[]).includes(up) ? (up as Gender) : null;
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

const VALID_LOOKING_FOR = ["male", "female", "any"] as const;
type LookingFor = (typeof VALID_LOOKING_FOR)[number];

function normalizeLookingFor(value: unknown): LookingFor | null {
  if (value == null) return null;
  const low = String(value).toLowerCase();
  return (VALID_LOOKING_FOR as readonly string[]).includes(low) ? (low as LookingFor) : null;
}

interface ProfileBody {
  deviceId?: string;
  gender?: string;
  city?: string;
  lang?: string;
  bio?: string;
  lookingFor?: string;
  photos?: string;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  if (!isDbConfigured) {
    return NextResponse.json({ ok: false });
  }

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = body.deviceId?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  }

  const gender = normalizeGender(body.gender);
  const city = body.city ?? null;
  const lang = body.lang ?? null;
  const bio = body.bio ?? null;
  const lookingFor = normalizeLookingFor(body.lookingFor);
  const photos = body.photos ?? null;

  const profile = await db.mobileProfile.upsert({
    where: { deviceId },
    create: { deviceId, gender, city, lang, bio, lookingFor, photos },
    update: { gender, city, lang, bio, lookingFor, photos },
  });

  return NextResponse.json({ ok: true, profile });
}

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

  const profile = await db.mobileProfile.findUnique({ where: { deviceId } });
  return NextResponse.json({ ok: true, profile });
}
