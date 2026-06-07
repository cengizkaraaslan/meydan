import "server-only";

export interface ReminderEmailInput {
  userName?: string | null;
  eventTitle: string;
  eventCity: string;
  eventDate: string; // already formatted Turkish (e.g. "30 Mayıs Cuma, 20:00")
  eventUrl: string; // absolute URL preferred
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function reminderEmailHtml(input: ReminderEmailInput): string {
  const name = input.userName?.trim() ? escapeHtml(input.userName.trim()) : "Selam";
  const title = escapeHtml(input.eventTitle);
  const city = escapeHtml(input.eventCity);
  const date = escapeHtml(input.eventDate);
  const url = input.eventUrl;
  const prefsUrl = (() => {
    try {
      const u = new URL(input.eventUrl);
      return `${u.origin}/ayarlar/bildirimler`;
    } catch {
      return "/ayarlar/bildirimler";
    }
  })();

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} — Yarın!</title>
</head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0b10;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.25);">
          <!-- Header (gradient) -->
          <tr>
            <td style="background-image:linear-gradient(135deg,#7c3aed 0%,#f97316 100%);padding:32px 28px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.85;">MeydanFest</div>
              <div style="margin-top:6px;font-size:24px;font-weight:700;line-height:1.25;">⏰ Yarın etkinliğin var!</div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 28px 12px 28px;">
              <div style="font-size:15px;color:#374151;line-height:1.55;">
                Merhaba ${name},<br />
                Katılacağını söylediğin etkinlik yarın başlıyor — unutma!
              </div>
            </td>
          </tr>

          <!-- Event card -->
          <tr>
            <td style="padding:8px 28px 20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="font-size:18px;font-weight:700;color:#111827;line-height:1.35;">${title}</div>
                    <div style="margin-top:10px;font-size:14px;color:#4b5563;line-height:1.55;">
                      📍 ${city}<br />
                      📅 ${date}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:8px 28px 28px 28px;">
              <a href="${url}" style="display:inline-block;background-image:linear-gradient(135deg,#7c3aed 0%,#f97316 100%);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;">
                Etkinliğe git →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 28px 28px;border-top:1px solid #e5e7eb;background:#fafafa;">
              <div style="font-size:12px;color:#6b7280;line-height:1.6;text-align:center;">
                Bu maili, MeydanFest'te ${title} etkinliğine RSVP verdiğin için aldın.<br />
                Bu maili almak istemiyorsan: <a href="${prefsUrl}" style="color:#7c3aed;text-decoration:none;">${prefsUrl}</a>
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top:14px;font-size:11px;color:#9ca3af;">
          © MeydanFest
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function reminderEmailText(input: ReminderEmailInput): string {
  const name = input.userName?.trim() ?? "Selam";
  const prefsUrl = (() => {
    try {
      const u = new URL(input.eventUrl);
      return `${u.origin}/ayarlar/bildirimler`;
    } catch {
      return "/ayarlar/bildirimler";
    }
  })();
  return [
    `Merhaba ${name},`,
    "",
    `Katılacağını söylediğin etkinlik yarın başlıyor:`,
    "",
    `  ${input.eventTitle}`,
    `  ${input.eventCity}`,
    `  ${input.eventDate}`,
    "",
    `Etkinliğe git: ${input.eventUrl}`,
    "",
    "—",
    `Bu maili almak istemiyorsan: ${prefsUrl}`,
    "© MeydanFest",
  ].join("\n");
}
