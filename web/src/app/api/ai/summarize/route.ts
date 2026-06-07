import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { generateEventSummary } from "@/lib/ai/summary";
import { aiConfigured } from "@/lib/ai/client";

export const runtime = "nodejs";

interface Body {
  slug?: string;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  if (!aiConfigured()) {
    return NextResponse.json({ summary: null, configured: false });
  }

  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ summary: null }, { status: 404 });
  }

  const summary = await generateEventSummary(event);
  return NextResponse.json(
    { summary, configured: true },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
