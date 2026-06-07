import { NextResponse, type NextRequest } from "next/server";
import { sendPush } from "@/lib/push-server";
import { sendEmail } from "@/lib/email";
import { reminderEmailHtml, reminderEmailText } from "@/lib/email-templates";
import { getAllRsvpsForTimeRange } from "@/lib/rsvp-store";
import { formatEventDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ReminderResult {
  slug: string;
  userEmail: string;
  pushOk: boolean;
  emailOk: boolean;
  emailError?: string;
}

function siteOrigin(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "meydanfest.com";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const entries = await getAllRsvpsForTimeRange(now, to);

  const origin = siteOrigin(request);
  const results: ReminderResult[] = [];

  for (const { userEmail, slug, record } of entries) {
    const eventUrl = `${origin}/etkinlik/${slug}`;
    const eventDate = formatEventDate(record.eventStartsAt);

    // Web push — sendPush(null, ...) tüm abonelere yayın yapıyor (faz 4 placeholder).
    // İleride per-user kanal eklendiğinde burası refactor edilecek.
    let pushOk = false;
    try {
      const pushResults = await sendPush(null, {
        title: `⏰ Yarın: ${record.eventTitle}`,
        body: `${record.eventCity} — etkinliğe katılıyorsun`,
        url: `/etkinlik/${slug}`,
      });
      pushOk = pushResults.some((r) => r.ok);
    } catch {
      pushOk = false;
    }

    const html = reminderEmailHtml({
      userName: userEmail.split("@")[0] ?? null,
      eventTitle: record.eventTitle,
      eventCity: record.eventCity,
      eventDate,
      eventUrl,
    });
    const text = reminderEmailText({
      userName: userEmail.split("@")[0] ?? null,
      eventTitle: record.eventTitle,
      eventCity: record.eventCity,
      eventDate,
      eventUrl,
    });

    const emailRes = await sendEmail({
      to: userEmail,
      subject: `Yarın: ${record.eventTitle}`,
      html,
      text,
    });

    results.push({
      slug,
      userEmail,
      pushOk,
      emailOk: emailRes.ok,
      emailError: emailRes.ok ? undefined : emailRes.error,
    });
  }

  return NextResponse.json({
    ran_at: now.toISOString(),
    reminders_sent: results.length,
    results,
  });
}
