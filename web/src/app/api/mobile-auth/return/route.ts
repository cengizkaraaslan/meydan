import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REDIRECT = "meydanfest://auth";

/**
 * Mobil dönüş ucu. NextAuth Google girişi tamamlandıktan SONRA callbackUrl olarak
 * buraya gelinir. Burada Google'a değil, OTURUMA bakarız (ek redirect_uri whitelist
 * GEREKMEZ) ve sonucu uygulamanın custom scheme'ine 302 ile aktarırız.
 *
 * 302 kullanıyoruz çünkü Android Chrome Custom Tabs, JS ile custom-scheme'e atlamayı
 * bloklar; Location header'lı 302 ise OS tarafından güvenilir yakalanır.
 */
function appRedirect(target: string): Response {
  const safe = target.replace(/"/g, "&quot;");
  const body = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#08070D;color:#F5F3FF;font-family:system-ui,sans-serif;text-align:center;padding-top:100px;margin:0"><div style="font-size:40px">✦</div><p style="margin-top:16px">MeydanFest'e dönülüyor…</p><a href="${safe}" style="color:#A855F7;font-weight:700;text-decoration:none">Uygulamaya dön →</a></body></html>`;
  return new Response(body, {
    status: 302,
    headers: { Location: target, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const session = await auth().catch(() => null);
  const u = session?.user;
  if (!u?.email) {
    return appRedirect(`${DEFAULT_REDIRECT}?error=1`);
  }
  const target =
    `${DEFAULT_REDIRECT}?email=${encodeURIComponent(u.email)}` +
    `&name=${encodeURIComponent(u.name ?? "")}` +
    `&photo=${encodeURIComponent(u.image ?? "")}`;
  return appRedirect(target);
}
