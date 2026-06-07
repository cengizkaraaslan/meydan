/**
 * GET /api/random-buddy?city=...&exclude=u1,u2&gender=F
 *
 * "Sürpriz biriyle eşleş" akışı için tek bir random buddy döner.
 * Pool boşaldıysa { buddy: null }.
 */

import { NextResponse, type NextRequest } from "next/server";
import { pickRandomBuddy } from "@/lib/random-buddy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const city = sp.get("city")?.trim() || undefined;
  const excludeRaw = sp.get("exclude")?.trim() || "";
  const exclude = excludeRaw
    ? excludeRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const genderParam = (sp.get("gender") || "").toUpperCase();
  const genderPreference =
    genderParam === "M" || genderParam === "F"
      ? (genderParam as "M" | "F")
      : "any";

  const buddy = pickRandomBuddy({
    city,
    genderPreference,
    exclude,
  });

  return NextResponse.json({ buddy });
}
