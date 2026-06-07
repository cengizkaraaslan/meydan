import "server-only";
import { isDbConfigured } from "./db";

/**
 * Hibrit depolama yardımcısı. DATABASE_URL varsa (isDbConfigured) Prisma yolunu
 * dener; tablo henüz yoksa / DB hatası olursa in-memory fallback'e düşer
 * (sayfa asla 500 vermesin). `prisma db push` çalıştırılmadan deploy edilse
 * bile site ayakta kalır. Tüm *-store.ts dosyaları bunu kullanır.
 */
export async function withDb<T>(dbFn: () => Promise<T>, memFn: () => T | Promise<T>): Promise<T> {
  if (isDbConfigured) {
    try {
      return await dbFn();
    } catch (e) {
      console.error(
        "[db-fallback] DB hatası — in-memory'e düşülüyor (prisma db push gerekebilir):",
        e instanceof Error ? e.message : e,
      );
    }
  }
  return memFn();
}

export { isDbConfigured };
