/**
 * DB snapshot DIŞA AKTAR → repo'ya JSON yaz (prisma/seed-data/).
 * Amaç: scraper'ların doldurduğu Event + Place verisini repoya gömüp, BAŞKA bir Neon
 * DB'sine geçtiğimizde `seed-db.cjs` ile ANINDA yüklemek (scraper beklemeden).
 *
 * Kullanım (DOLU bir DB'ye bağlıyken, direct host önerilir):
 *   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/export-snapshot.cjs
 *
 * Çıktı: prisma/seed-data/events.json, prisma/seed-data/places.json (git'e commit edilir).
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const db = new PrismaClient();

(async () => {
  const dir = path.join(__dirname, "..", "prisma", "seed-data");
  fs.mkdirSync(dir, { recursive: true });

  // İlişkiler findMany varsayılanında gelmez → yalnız skaler alanlar (seed için ideal).
  const events = await db.event.findMany({ orderBy: { startsAt: "asc" } });
  const places = await db.place.findMany({ orderBy: { name: "asc" } });

  fs.writeFileSync(path.join(dir, "events.json"), JSON.stringify(events));
  fs.writeFileSync(path.join(dir, "places.json"), JSON.stringify(places));

  console.log(`✔ Dışa aktarıldı: ${events.length} etkinlik, ${places.length} yer → prisma/seed-data/`);
  await db.$disconnect();
})().catch(async (e) => {
  console.error("✖ Export hatası:", e.message);
  await db.$disconnect();
  process.exit(1);
});
