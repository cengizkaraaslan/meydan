import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./auth";
import { useAuth } from "./auth";
import { API_BASE } from "./api";

/** Varsayılan/kurucu admin (her zaman admin). */
export const ADMIN_EMAIL = "cengiz7karaaslan@gmail.com";

/** Sunucudan (DB role=ADMIN) doğrulanan ek admin e-postaları cihazda önbelleğe alınır. */
export const KEY_EXTRA_ADMINS = "meydanfest:admins";

// Modül-içi önbellek: panelden terfi ettirilen adminler (whoami sonucu).
const extraAdmins = new Set<string>();
let hydrated = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY_EXTRA_ADMINS);
    if (raw) for (const e of JSON.parse(raw) as string[]) extraAdmins.add(e.toLowerCase());
  } catch {
    /* yok say */
  }
}
void hydrate();

/** Sabit kurucu mu? (senkron, sunucusuz) */
export function isFounderEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}

/** Kurucu VEYA önbellekteki (sunucudan doğrulanmış) admin mi? (senkron) */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === ADMIN_EMAIL || extraAdmins.has(e);
}

export function isAdmin(user: AuthUser | null): boolean {
  return isAdminEmail(user?.email);
}

/**
 * Sunucuya sorar: bu e-posta admin mi (kurucu VEYA DB role=ADMIN)? Sonucu
 * önbelleğe yazar ki sonraki senkron isAdmin() çağrıları da doğru dönsün.
 */
export async function checkAdminRemote(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (isFounderEmail(email)) return true;
  await hydrate();
  const e = email.trim().toLowerCase();
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/whoami?email=${encodeURIComponent(email)}`, {
      headers: { Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as { isAdmin?: boolean };
    const admin = data?.isAdmin === true;
    if (admin) extraAdmins.add(e);
    else extraAdmins.delete(e);
    void AsyncStorage.setItem(KEY_EXTRA_ADMINS, JSON.stringify([...extraAdmins]));
    return admin;
  } catch {
    return extraAdmins.has(e); // çevrimdışı → önbellek
  }
}

/**
 * Reaktif admin durumu. `ready` true olana kadar guard'lar yönlendirme YAPMAMALI
 * (terfi edilen admin sunucudan doğrulanırken yanlışlıkla atılmasın). Kurucu anında hazır.
 */
export function useIsAdmin(): { admin: boolean; ready: boolean } {
  const { user } = useAuth();
  const email = user?.email ?? null;
  const founder = isFounderEmail(email);
  const [admin, setAdmin] = useState<boolean>(founder || isAdminEmail(email));
  const [ready, setReady] = useState<boolean>(founder || !email);

  useEffect(() => {
    let alive = true;
    if (!email) {
      setAdmin(false);
      setReady(true);
      return;
    }
    if (isFounderEmail(email)) {
      setAdmin(true);
      setReady(true);
      return;
    }
    setReady(false);
    void checkAdminRemote(email).then((v) => {
      if (alive) {
        setAdmin(v);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [email]);

  return { admin, ready };
}
