import { NextResponse, type NextRequest } from "next/server";
import { getCourseGroups, type CourseGroup } from "@/lib/courses";

export const dynamic = "force-dynamic";

/** Türkçe-duyarsız karşılaştırma anahtarı (şehir filtresi için). */
function fold(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ş/g, "s").replace(/Ş/g, "s").replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u").replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase().trim();
}

/**
 * Belediye ücretsiz kursları (ESMEK/KOMEK/GASMEK/İZMEK/KAYMEK) — mobil app
 * "Ücretsiz Kurslar" bölümü bunu tüketir. Opsiyonel ?city= ile şehre süzülür.
 * Anahtar: diğer v1 route'lardaki gibi prod'da X-Api-Key / api_key beklenir.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const apiKey = request.headers.get("x-api-key") ?? sp.get("api_key");
  if (process.env.NODE_ENV === "production" && !apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Send 'X-Api-Key' header or 'api_key' query param." },
      { status: 401 },
    );
  }

  try {
    const groups = (await getCourseGroups()) as CourseGroup[];
    const city = sp.get("city");
    const data: CourseGroup[] = city
      ? groups.flatMap((g: CourseGroup) => {
          // Ulusal kaynak (İŞKUR): grubu KURS-bazlı süz (her kurs kendi ilini taşır).
          if (g.provider.national) {
            const courses = g.courses.filter((c) => c.city && fold(c.city) === fold(city));
            return courses.length ? [{ ...g, courses }] : [];
          }
          // Belediye kaynakları: sağlayıcının şehri eşleşiyorsa tüm grubu döndür.
          return fold(g.provider.city) === fold(city) ? [g] : [];
        })
      : groups;
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: true, data: [] });
  }
}
