import { db, isDbConfigured } from "@/lib/db";

/**
 * Admin yetkisi tek yerden: KURUCU e-posta whitelist'i (env AUTH_ADMIN_EMAILS)
 * VEYA DB'de User.role === "ADMIN". Böylece panelden terfi ettirilen kullanıcılar
 * da gerçekten admin sayılır (yalnızca sabit e-postaya bağlı kalmaz).
 */
const FOUNDER_EMAILS: Set<string> = new Set(
  (process.env.AUTH_ADMIN_EMAILS ?? "cengiz7karaaslan@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** Sabit kurucu e-postası mı? (DB'siz, senkron — guard'lar için.) */
export function isFounderEmail(email?: string | null): boolean {
  return !!email && FOUNDER_EMAILS.has(email.trim().toLowerCase());
}

/** Kurucu mu ya da DB'de role=ADMIN mi? (async — DB'ye bakar.) */
export async function isAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (isFounderEmail(email)) return true;
  if (!isDbConfigured) return false;
  try {
    const u = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { role: true },
    });
    return u?.role === "ADMIN";
  } catch {
    return false;
  }
}
