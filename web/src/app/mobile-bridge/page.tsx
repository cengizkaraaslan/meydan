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
      <body style={{ background: "#08070D", color: "#F5F3FF", fontFamily: "system-ui, sans-serif", textAlign: "center", paddingTop: 100, margin: 0 }}>
        <div style={{ fontSize: 40 }}>✦</div>
        <AutoGoogle />
      </body>
    </html>
  );
}
