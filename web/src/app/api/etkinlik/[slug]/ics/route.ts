import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";

export const dynamic = "force-dynamic";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Date → 20260530T180000Z formatı (ICS UTC) */
function toIcsDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** ICS spec: virgül, noktalı virgül, yeni satır escape edilir */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** ICS 75 oktet sınırı için satır kırma */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    const slice = line.slice(i, i + 73);
    chunks.push(i === 0 ? slice : " " + slice);
    i += 73;
  }
  return chunks.join("\r\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Etkinlik bulunamadı" }, { status: 404 });
  }

  const start = new Date(event.startsAt);
  // endsAt yoksa varsayılan 3 saat sonra
  const end = event.endsAt
    ? new Date(event.endsAt)
    : new Date(start.getTime() + 3 * 60 * 60 * 1000);

  const now = new Date();
  const uid = `${event.slug}@meydanfest.app`;
  const url = `https://etkinlikscout.vercel.app/etkinlik/${event.slug}`;
  const summary = escapeIcsText(event.title);
  const location = escapeIcsText(`${event.venue}, ${event.city}`);
  const description = escapeIcsText(
    `${event.description ?? event.title}\n\nDetaylar: ${url}`,
  );

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeydanFest//Etkinlik//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    foldLine(`DTSTAMP:${toIcsDate(now)}`),
    foldLine(`DTSTART:${toIcsDate(start)}`),
    foldLine(`DTEND:${toIcsDate(end)}`),
    foldLine(`SUMMARY:${summary}`),
    foldLine(`LOCATION:${location}`),
    foldLine(`DESCRIPTION:${description}`),
    foldLine(`URL:${url}`),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    foldLine(`DESCRIPTION:${summary} - 2 saat sonra başlıyor`),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const body = lines.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
