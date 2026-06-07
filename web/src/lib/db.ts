import "server-only";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const isDbConfigured = Boolean(process.env.DATABASE_URL);
// Etkinlik veri kaynağı: yalnızca AÇIKÇA "false" dendiğinde DB'den oku; aksi halde
// (boş, "true", tanımsız) mock+snapshot kullan. Böylece DATABASE_URL eklemek etkinlikleri
// boş Event tablosuna düşürmez. (Story/RSVP/vb. bundan bağımsız — onlar isDbConfigured'a bakar.)
export const useMockData = process.env.USE_MOCK_DATA !== "false" || !isDbConfigured;

export const db: PrismaClient = global.prismaGlobal ?? (isDbConfigured ? createClient() : (undefined as unknown as PrismaClient));

if (process.env.NODE_ENV !== "production" && isDbConfigured) {
  global.prismaGlobal = db;
}
