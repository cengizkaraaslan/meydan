import type { AuthUser } from "./auth";

/** Varsayılan/kurucu admin. */
export const ADMIN_EMAIL = "cengiz7karaaslan@gmail.com";

/** Ek admin'ler cihazda saklanır (gerçek backend yok). */
export const KEY_EXTRA_ADMINS = "meydanfest:admins";

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdmin(user: AuthUser | null): boolean {
  return isAdminEmail(user?.email);
}
