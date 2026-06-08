import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AutoGoogle from "./AutoGoogle";

export const dynamic = "force-dynamic";

/**
 * Mobil Google-giriş köprüsü. MeydanFest (Expo) bunu WebBrowser ile açar:
 *   WebBrowser.openAuthSessionAsync(`${API_BASE}/mobile-bridge`, "meydanfest://auth")
 *
 * Oturum varsa doğrudan dönüş ucuna (oradan app'e 302) gider; yoksa AutoGoogle
 * sayfayı açar açmaz Google hesap seçiciye yönlendirir. Sadece mevcut WEB OAuth
 * client'ı ve /api/auth/callback/google kullanılır — ek redirect URI gerekmez.
 */
export default async function MobileBridge() {
  const session = await auth().catch(() => null);

  if (session?.user?.email) {
    redirect("/api/mobile-auth/return");
  }

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>MeydanFest</title>
        <style>{`@keyframes mf-spin{to{transform:rotate(360deg)}}@keyframes mf-pulse{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 24,
          textAlign: "center",
          background: "radial-gradient(120% 120% at 50% 0%, #1a0b2e 0%, #08070D 58%)",
          color: "#F5F3FF",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "3px solid rgba(168,85,247,0.25)",
            borderTopColor: "#A855F7",
            animation: "mf-spin 0.9s linear infinite",
          }}
        />
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>
          Meydan<span style={{ color: "#A855F7" }}>Fest</span>
        </div>
        <div style={{ fontSize: 15, color: "#EDE9FF", fontWeight: 600, maxWidth: 300 }}>
          Google hesabına yönlendiriliyorsun…
        </div>
        <div style={{ fontSize: 13, color: "#B9B4D0", animation: "mf-pulse 1.6s ease-in-out infinite", maxWidth: 300 }}>
          Birkaç saniye sürebilir. Açılmazsa aşağıdaki butona dokun.
        </div>
        <AutoGoogle />
      </body>
    </html>
  );
}
