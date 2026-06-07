import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db, isDbConfigured } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string | null;
      role?: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }
}

/**
 * DB (database session + PrismaAdapter) YALNIZCA AUTH_USE_DB=1 iken kullanılır.
 * Prod DB erişilemez olduğunda (AdapterError) NextAuth tüm girişleri "Configuration"
 * hatasıyla reddediyordu. Varsayılan artık JWT (DB'siz) — giriş DB sağlığına bağlı
 * değil. DB düzeltilince AUTH_USE_DB=1 ekleyip database session'a geri dönülebilir.
 */
const useDatabase = isDbConfigured && process.env.AUTH_USE_DB === "1";

/**
 * Admin emaillerini env var'dan al; yoksa bilinen kurucu email'leri kullan.
 * Production'da AUTH_ADMIN_EMAILS env (virgülle ayrılmış) ile yönetilir.
 */
const ADMIN_EMAILS: Set<string> = new Set(
  (process.env.AUTH_ADMIN_EMAILS ?? "cengiz7karaaslan@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

function resolveRole(email: string | null | undefined): "USER" | "ADMIN" {
  if (!email) return "USER";
  return ADMIN_EMAILS.has(email.toLowerCase()) ? "ADMIN" : "USER";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(useDatabase ? { adapter: PrismaAdapter(db) } : {}),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Her girişte hesap seçici göster (mobil köprüde birden çok hesap için).
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: useDatabase ? "database" : "jwt" },
  pages: { signIn: "/giris" },
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        session.user.id = (user?.id as string) ?? (token?.sub as string);
        if (useDatabase && user) {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { username: true, role: true },
          });
          session.user.username = dbUser?.username ?? null;
          // DB role'ünü email whitelist ile birleştir — kurucu email her zaman ADMIN
          const emailRole = resolveRole(session.user.email);
          session.user.role = emailRole === "ADMIN" ? "ADMIN" : dbUser?.role ?? "USER";
        } else {
          // JWT mode — token üzerinden role'ü oku
          const tokenRole = (token?.role as "USER" | "ADMIN" | undefined) ?? "USER";
          const emailRole = resolveRole(session.user.email);
          session.user.role = emailRole === "ADMIN" ? "ADMIN" : tokenRole;
          session.user.username = (token?.username as string) ?? null;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = resolveRole(user.email);
      } else if (token?.email && !token.role) {
        token.role = resolveRole(token.email as string);
      }
      return token;
    },
  },
  trustHost: true,
});
