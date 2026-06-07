import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Mobil Google-giriş köprüsü. MeydanFest (Expo) bu sayfayı WebBrowser ile açar:
 *   WebBrowser.openAuthSessionAsync(`${API_BASE}/mobile-bridge`, "meydanfest://auth")
 * Oturum yoksa next-auth Google girişine yönlendirir (mevcut WEB client'ı kullanır,
 * ek OAuth client GEREKMEZ). Giriş sonrası buraya döner, oturum bilgisini app şemasına
 * (meydanfest://auth?email&name&photo) aktarır. Böylece mobil, web'in Google'ını kullanır.
 */
export default async function MobileBridge() {
  const session = await auth().catch(() => null);

  if (!session?.user?.email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/mobile-bridge")}`);
  }

  const u = session!.user!;
  const target =
    `meydanfest://auth?email=${encodeURIComponent(u.email ?? "")}` +
    `&name=${encodeURIComponent(u.name ?? "")}` +
    `&photo=${encodeURIComponent(u.image ?? "")}`;

  return (
    <html lang="tr">
      <body style={{ background: "#08070D", color: "#F5F3FF", fontFamily: "system-ui, sans-serif", textAlign: "center", paddingTop: 100 }}>
        <div style={{ fontSize: 40 }}>✦</div>
        <p style={{ marginTop: 16 }}>Giriş başarılı, MeydanFest'e dönülüyor…</p>
        <a href={target} style={{ color: "#A855F7", fontWeight: 700 }}>Uygulamaya dön →</a>
        <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){location.href=${JSON.stringify(target)}},300)` }} />
      </body>
    </html>
  );
}
