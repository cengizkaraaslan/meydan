import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth";

/**
 * Google köprüsü dönüş ucu: meydanfest://auth?email&name&photo
 *
 * Normalde girişi WebBrowser.openAuthSessionAsync sonucu (auth.tsx) tamamlar.
 * Ama bazı cihazlarda 302 custom-scheme'i OS intent olarak açıp expo-router'a
 * /auth yönlendiriyor → "unmatched route" hatası. Bu ekran o rotayı geçerli
 * kılar; parametre geldiyse girişi yedek olarak tamamlar ve ana akışa döner.
 */
export default function AuthReturn() {
  const { email, name } = useLocalSearchParams<{ email?: string; name?: string; photo?: string }>();
  const { user, signInWithEmail } = useAuth();

  useEffect(() => {
    const mail = typeof email === "string" ? email : "";
    if (!user && mail) {
      void signInWithEmail(typeof name === "string" ? name : "", mail);
    }
  }, [email, name, user, signInWithEmail]);

  return <Redirect href="/" />;
}
