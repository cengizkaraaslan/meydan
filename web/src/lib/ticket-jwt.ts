import "server-only";
import jwt from "jsonwebtoken";

export interface TicketPayload {
  slug: string;
  userEmail: string;
  userName: string;
  issuedAt: number; // ms
}

/**
 * AUTH_SECRET'i NextAuth ile paylaşıyoruz. Dev'de yoksa deterministik dev
 * fallback'i kullanıyoruz — prod'da AUTH_SECRET zorunlu (NextAuth zaten throw eder).
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production to sign tickets");
  }
  return "meydanfest-dev-fallback-secret-do-not-use-in-prod";
}

export function signTicket(payload: TicketPayload): string {
  return jwt.sign(payload, getSecret(), { algorithm: "HS256" });
}

export function verifyTicket(token: string): TicketPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof (decoded as TicketPayload).slug === "string" &&
      typeof (decoded as TicketPayload).userEmail === "string" &&
      typeof (decoded as TicketPayload).userName === "string" &&
      typeof (decoded as TicketPayload).issuedAt === "number"
    ) {
      const p = decoded as TicketPayload & { iat?: number; exp?: number };
      return {
        slug: p.slug,
        userEmail: p.userEmail,
        userName: p.userName,
        issuedAt: p.issuedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}
