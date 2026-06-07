import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REDIRECT = "meydanfest://auth";

/**
 * Mobil Google-giriş başlangıcı. MeydanFest (Expo) bu route'u auth-session ile açar;
 * tarayıcıda SADECE Google hesap seçici görünür (etkinlikscout sayfası DEĞİL).
 * Web'in mevcut AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET'i kullanılır — ek OAuth client gerekmez.
 * Başarılı girişte callback, kullanıcı bilgisini app şemasına (state deep link) aktarır.
 */
export function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect") ?? DEFAULT_REDIRECT;
  const clientId = process.env.AUTH_GOOGLE_ID ?? "";

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${origin}/api/mobile-auth/callback`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("prompt", "select_account");
  authorize.searchParams.set("access_type", "online");
  authorize.searchParams.set("state", redirect);

  return NextResponse.redirect(authorize.toString(), 302);
}
