import { NextResponse, type NextRequest } from "next/server";
import { parseSearchQuery } from "@/lib/ai/search-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  query?: string;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = body.query?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const { params, summary } = await parseSearchQuery(query);
  const qs = params.toString();
  const redirectTo = qs ? `/etkinlikler?${qs}` : `/etkinlikler`;

  return NextResponse.json({ redirectTo, summary });
}
