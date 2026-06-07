import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REDIRECT = "meydanfest://auth";

interface TokenResponse {
  access_token?: string;
  id_token?: string;
}

interface UserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

function htmlRedirect(target: string): Response {
  const body = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#08070D;color:#F5F3FF;font-family:system-ui,sans-serif;text-align:center;padding-top:100px;margin:0"><div style="font-size:40px">✦</div><p style="margin-top:16px">MeydanFest'e dönülüyor…</p><a href="${target.replace(/"/g, "&quot;")}" style="color:#A855F7;font-weight:700;text-decoration:none">Uygulamaya dön →</a><script>location.href=${JSON.stringify(target)}</script></body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Google OAuth2 code → token → userinfo değişimi. Sonucu state deep link'ine
 * (meydanfest://auth) email/name/photo query param'larıyla aktarır. Hata olursa
 * ?error=1 ile döner ki app spinner'ı durdurabilsin.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const state = searchParams.get("state") || DEFAULT_REDIRECT;
  const code = searchParams.get("code");

  if (!code) {
    return htmlRedirect(`${state}?error=1`);
  }

  try {
    const redirectUri = `${origin}/api/mobile-auth/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.AUTH_GOOGLE_ID ?? "",
        client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      return htmlRedirect(`${state}?error=1`);
    }

    const tokens = (await tokenRes.json()) as TokenResponse;
    if (!tokens.access_token) {
      return htmlRedirect(`${state}?error=1`);
    }

    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!infoRes.ok) {
      return htmlRedirect(`${state}?error=1`);
    }

    const info = (await infoRes.json()) as UserInfo;
    const target =
      `${state}?email=${encodeURIComponent(info.email ?? "")}` +
      `&name=${encodeURIComponent(info.name ?? "")}` +
      `&photo=${encodeURIComponent(info.picture ?? "")}`;

    return htmlRedirect(target);
  } catch {
    return htmlRedirect(`${state}?error=1`);
  }
}
