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
  city?: string | null;
  district?: string | null;
  lang?: string;
  bio?: string;
  lookingFor?: string;
  photos?: string;
  avatar?: string | null;
  name?: string;
  lat?: number | null;
  lng?: number | null;
  birthDate?: string | null;
  showAge?: boolean;
  heightCm?: string | null;
  weightKg?: string | null;
  interests?: string | null;
  goal?: string | null;
  languages?: string | null;
  zodiac?: string | null;
  education?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  exercise?: string | null;
}

/** Boş/whitespace string'i null'a indirger (alan temizleme için). */
function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Sayıya çevirir; geçersiz/boşsa null. */
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  // Yalnızca gövdede AÇIKÇA gönderilen alanları yaz — kısmi senkron (örn. sadece
  // {city,district}) diğer kolonları (gender/avatar/bio…) null'a ÇEKMESİN.
  const data: Record<string, unknown> = {};
  if ("gender" in body) data.gender = normalizeGender(body.gender);
  if ("city" in body) data.city = strOrNull(body.city);
  if ("district" in body) data.district = strOrNull(body.district);
  if ("lang" in body) data.lang = strOrNull(body.lang);
  if ("bio" in body) data.bio = strOrNull(body.bio);
  if ("lookingFor" in body) data.lookingFor = normalizeLookingFor(body.lookingFor);
  if ("photos" in body) data.photos = strOrNull(body.photos);
  if ("avatar" in body) {
    // Güvenlik: yalnız http(s) public URL veya null kabul et. "file://" gibi YEREL yollar
    // başka cihazda yüklenmez → yoksay (mevcut avatar korunur), DB'ye yazma.
    const a = strOrNull(body.avatar);
    if (a === null || /^https?:\/\//.test(a)) data.avatar = a;
  }
  if ("lat" in body) data.lat = numOrNull(body.lat);
  if ("lng" in body) data.lng = numOrNull(body.lng);
  if ("birthDate" in body) data.birthDate = strOrNull(body.birthDate);
  if ("showAge" in body) data.showAge = Boolean(body.showAge);
  if ("heightCm" in body) data.heightCm = strOrNull(body.heightCm);
  if ("weightKg" in body) data.weightKg = strOrNull(body.weightKg);
  if ("interests" in body) data.interests = strOrNull(body.interests);
  if ("goal" in body) data.goal = strOrNull(body.goal);
  if ("languages" in body) data.languages = strOrNull(body.languages);
  if ("zodiac" in body) data.zodiac = strOrNull(body.zodiac);
  if ("education" in body) data.education = strOrNull(body.education);
  if ("drinking" in body) data.drinking = strOrNull(body.drinking);
  if ("smoking" in body) data.smoking = strOrNull(body.smoking);
  if ("exercise" in body) data.exercise = strOrNull(body.exercise);

  // district/avatar yeni kolonlar — `prisma generate` (Vercel build) sonrası tipler
  // güncellenir; yerel stale client'ta derlensin diye unknown üzerinden cast.
  type UpsertArgs = Parameters<typeof db.mobileProfile.upsert>[0];
  const run = (d: Record<string, unknown>) =>
    db.mobileProfile.upsert({
      where: { deviceId },
      create: { deviceId, ...d } as unknown as UpsertArgs["create"],
      update: d as unknown as UpsertArgs["update"],
    });

  try {
    const profile = await run(data);
    return NextResponse.json({ ok: true, profile });
  } catch {
    // district/avatar kolonları henüz DB'de yoksa (db push öncesi) onları atıp tekrar dene
    // → diğer alanlar (gender/city/lang…) çalışmaya devam eder, prod bozulmaz.
    const rest = { ...data };
    delete rest.district;
    delete rest.avatar;
    delete rest.lat;
    delete rest.lng;
    delete rest.birthDate;
    delete rest.showAge;
    delete rest.heightCm;
    delete rest.weightKg;
    delete rest.interests;
    delete rest.goal;
    delete rest.languages;
    delete rest.zodiac;
    delete rest.education;
    delete rest.drinking;
    delete rest.smoking;
    delete rest.exercise;
    try {
      const profile = await run(rest);
      return NextResponse.json({ ok: true, profile });
    } catch {
      return NextResponse.json({ ok: false });
    }
  }
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
  // birthDate/showAge yeni kolonlar — findUnique tüm kolonları döndürür; stale
  // client tipinde görünmeyebilir diye unknown üzerinden cast ile garanti et.
  const p = profile as unknown as Record<string, unknown> | null;
  return NextResponse.json({
    ok: true,
    profile: p
      ? {
          ...p,
          birthDate: p.birthDate ?? null,
          showAge: p.showAge ?? true,
          heightCm: p.heightCm ?? null,
          weightKg: p.weightKg ?? null,
          interests: p.interests ?? null,
          goal: p.goal ?? null,
          languages: p.languages ?? null,
          zodiac: p.zodiac ?? null,
          education: p.education ?? null,
          drinking: p.drinking ?? null,
          smoking: p.smoking ?? null,
          exercise: p.exercise ?? null,
        }
      : p,
  });
}
