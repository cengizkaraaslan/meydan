import { NextResponse, type NextRequest } from "next/server";
import { verifyTicket } from "@/lib/ticket-jwt";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { valid: false, error: "missing_token" },
      { status: 400 },
    );
  }

  const payload = verifyTicket(token);
  if (!payload) {
    return NextResponse.json(
      { valid: false, error: "invalid_token" },
      { status: 200 },
    );
  }

  return NextResponse.json({
    valid: true,
    slug: payload.slug,
    userName: payload.userName,
    issuedAt: new Date(payload.issuedAt).toISOString(),
  });
}
