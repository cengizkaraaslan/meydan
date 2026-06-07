"use client";
import { useEffect } from "react";
import { signIn } from "next-auth/react";

/**
 * Mobil köprü: sayfa açılır açılmaz doğrudan Google hesap seçiciye gider
 * (etkinlikscout /giris sayfasını GÖSTERMEDEN). NextAuth Google akışı çalışır →
 * mevcut /api/auth/callback/google kullanılır (ek redirect URI gerekmez) →
 * giriş sonrası callbackUrl olarak /api/mobile-auth/return'e döner; o da
 * uygulamaya (meydanfest://) 302 ile aktarır.
 */
export default function AutoGoogle() {
  useEffect(() => {
    void signIn("google", { callbackUrl: "/api/mobile-auth/return" });
  }, []);
  return <p style={{ marginTop: 16 }}>Google&apos;a yönlendiriliyor…</p>;
}
