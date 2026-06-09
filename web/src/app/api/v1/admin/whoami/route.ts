import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/whoami?email=<email>
 * Verilen e-posta admin mi? (kurucu whitelist VEYA DB role=ADMIN). Mobil/web
 * istemcileri admin geçidini sunucu rolüne göre belirlemek için kullanır.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const admin = await isAdminEmail(email);
  return NextResponse.json({ ok: true, email: email ?? null, isAdmin: admin });
}
