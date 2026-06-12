import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as Linking from "expo-linking";
import { API_BASE } from "./api";
import { setAccountKey, restoreAvatar, clearAccountScopedCache } from "./profileSync";
import { linkSocialIdentity } from "./social";

WebBrowser.maybeCompleteAuthSession();

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  photo?: string;
}

interface AuthState {
  user: AuthUser | null;
  guest: boolean;
  ready: boolean;
  configured: boolean;
  signingIn: boolean;
  signInWithGoogle: () => void;
  signInWithEmail: (name: string, email: string) => Promise<void>;
  continueAsGuest: () => void;
  signOut: () => void;
}

const KEY_USER = "meydanfest:auth:user";
const KEY_GUEST = "meydanfest:auth:guest";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  googleWebClientId?: string;
  googleAndroidClientId?: string;
};

function clean(v?: string) {
  return v && v.trim() && !v.includes("YOUR_") ? v.trim() : undefined;
}
const webClientId = clean(extra.googleWebClientId);
const androidClientId = clean(extra.googleAndroidClientId);
// Android'de Google auth için androidClientId ZORUNLU — yoksa hook throw eder.
const CONFIGURED = Boolean(androidClientId);

const AuthContext = createContext<AuthState | null>(null);

/**
 * Google hook'u yalnızca yapılandırma varsa mount edilir (aksi halde
 * useAuthRequest render'da throw edip uygulamayı çökertir). promptAsync'i
 * ref ile dışarı verir, başarılı girişte kullanıcıyı üst bileşene iletir.
 */
function GoogleBridge({
  register,
  onUser,
  onSettled,
}: {
  register: (fn: (() => void) | null) => void;
  onUser: (u: AuthUser) => void;
  onSettled: () => void;
}) {
  const [request, response, promptAsync] = Google.useAuthRequest({ webClientId, androidClientId });

  useEffect(() => {
    register(request ? () => promptAsync() : null);
    return () => register(null);
  }, [request, promptAsync, register]);

  useEffect(() => {
    if (!response) return;
    if (response.type !== "success") {
      onSettled();
      return;
    }
    const token = response.authentication?.accessToken;
    if (!token) {
      onSettled();
      return;
    }
    (async () => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const info = await res.json();
        onUser({
          id: info.sub ?? "google",
          name: info.name ?? "MeydanFest kullanıcısı",
          email: info.email ?? "",
          photo: info.picture,
        });
      } catch {
        onSettled();
      }
    })();
  }, [response, onUser, onSettled]);

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const promptRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, g] = await Promise.all([AsyncStorage.getItem(KEY_USER), AsyncStorage.getItem(KEY_GUEST)]);
        if (u) setUser(JSON.parse(u));
        if (g === "1") setGuest(true);
      } catch {
        /* yok say */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Kullanıcı hazır olunca (giriş VEYA açılışta oturum geri yüklenince): profili hesaba
  // (email) bağla ve sunucudaki avatar'ı yerele geri yükle → reinstall'da avatar kaybolmaz.
  useEffect(() => {
    if (user?.email) {
      setAccountKey(user.email);
      void restoreAvatar();
      // Sosyal gönderi kimliğini (cihaz UUID'si) hesaba bağla → gönderiden açılan sohbet
      // mesajları karşı tarafın acct:email sohbet listesine ulaşsın.
      void linkSocialIdentity(user.email);
    } else {
      setAccountKey(null);
    }
  }, [user?.email]);

  const handleUser = useCallback(async (u: AuthUser) => {
    // Hesap DEĞİŞTİyse (farklı e-posta) önceki hesabın yerel verisini temizle → karışmasın.
    // Aynı e-postayla tekrar giriş = aynı hesap (kimlik acct:email), temizlik YAPMA.
    try {
      const prevRaw = await AsyncStorage.getItem(KEY_USER);
      const prevEmail = prevRaw ? (JSON.parse(prevRaw) as AuthUser).email?.trim().toLowerCase() : null;
      if (prevEmail && prevEmail !== u.email.trim().toLowerCase()) {
        await clearAccountScopedCache();
      }
    } catch {
      /* yoksay */
    }
    setUser(u);
    setGuest(false);
    setSigningIn(false);
    await AsyncStorage.setItem(KEY_USER, JSON.stringify(u));
    await AsyncStorage.removeItem(KEY_GUEST);
  }, []);

  // Google girişi: web köprüsü (web'in mevcut next-auth Google'ı; native client ID gerekmez).
  // Native android client ID yapılandırıldıysa onu kullanır; aksi halde WebBrowser köprüsü.
  const signInWithGoogle = useCallback(async () => {
    if (CONFIGURED && promptRef.current) {
      setSigningIn(true);
      promptRef.current();
      return;
    }
    setSigningIn(true);
    try {
      const redirectUrl = Linking.createURL("auth"); // meydanfest://auth
      // Web köprüsü: NextAuth Google akışı (mevcut /api/auth/callback/google kullanılır,
      // ek redirect URI gerekmez). Köprü doğrudan Google hesap seçiciyi açar, giriş sonrası
      // /api/mobile-auth/return üzerinden uygulamaya 302 ile döner.
      const res = await WebBrowser.openAuthSessionAsync(`${API_BASE}/mobile-bridge`, redirectUrl);
      if (res.type === "success" && res.url) {
        const { queryParams } = Linking.parse(res.url);
        const email = String(queryParams?.email ?? "");
        if (email) {
          await handleUser({
            id: `google-${email.toLowerCase()}`,
            name: String(queryParams?.name ?? "") || email.split("@")[0],
            email: email.toLowerCase(),
            photo: queryParams?.photo ? String(queryParams.photo) : undefined,
          });
        }
      }
    } catch {
      /* iptal/başarısız → sessizce geç */
    } finally {
      setSigningIn(false);
    }
  }, [handleUser]);

  // E-posta ile giriş — Google OAuth client ID gerektirmez (hemen çalışır).
  const signInWithEmail = useCallback(async (name: string, email: string) => {
    const clean = email.trim().toLowerCase();
    await handleUser({ id: `email-${clean}`, name: name.trim() || clean.split("@")[0] || "Kullanıcı", email: clean });
  }, [handleUser]);

  const continueAsGuest = useCallback(async () => {
    setGuest(true);
    await AsyncStorage.setItem(KEY_GUEST, "1");
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setGuest(false);
    await AsyncStorage.multiRemove([KEY_USER, KEY_GUEST]);
    // Çıkışta da hesaba özel veriyi temizle → sonraki giren önceki hesabı görmesin.
    await clearAccountScopedCache();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, guest, ready, configured: true, signingIn, signInWithGoogle, signInWithEmail, continueAsGuest, signOut }}
    >
      {CONFIGURED && (
        <GoogleBridge register={(fn) => (promptRef.current = fn)} onUser={handleUser} onSettled={() => setSigningIn(false)} />
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
