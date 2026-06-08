"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

/**
 * Mobil köprü: sayfa açılır açılmaz doğrudan Google hesap seçiciye gider
 * (etkinlikscout /giris sayfasını GÖSTERMEDEN). NextAuth Google akışı çalışır →
 * mevcut /api/auth/callback/google kullanılır (ek redirect URI gerekmez) →
 * giriş sonrası callbackUrl olarak /api/mobile-auth/return'e döner; o da
 * uygulamaya (meydanfest://) 302 ile aktarır.
 *
 * Otomatik yönlendirme bazı tarayıcılarda tetiklenmeyebilir → birkaç saniye
 * sonra GÖRÜNÜR "Google ile devam et" butonu sunarız (takılı kalma olmasın).
 */
export default function AutoGoogle() {
  const [showButton, setShowButton] = useState(false);

  const go = () => void signIn("google", { callbackUrl: "/api/mobile-auth/return" });

  useEffect(() => {
    go(); // otomatik dene
    const tm = setTimeout(() => setShowButton(true), 2500); // takıldıysa elle buton
    return () => clearTimeout(tm);
  }, []);

  if (!showButton) return null;

  return (
    <button
      onClick={go}
      style={{
        marginTop: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "13px 22px",
        borderRadius: 999,
        border: "none",
        background: "#fff",
        color: "#1F1F1F",
        fontSize: 15,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: "pointer",
        boxShadow: "0 6px 24px rgba(168,85,247,0.25)",
      }}
    >
      <span style={{ color: "#4285F4", fontWeight: 800, fontSize: 17 }}>G</span>
      Google ile devam et
    </button>
  );
}
