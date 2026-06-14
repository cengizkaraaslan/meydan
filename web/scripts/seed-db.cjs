/**
 * DB SEED → repo snapshot'ını (prisma/seed-data/) DB'ye yükle.
 * Yeni bir Neon DB'sine geçince: `prisma db push` (şema) + bu script (veri) = scraper beklemeden dolu DB.
 *
 * Kullanım (YENİ DB direct host ile):
 *   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/seed-db.cjs
 *
 * Idempotent: createMany + skipDuplicates → tekrar çalıştırınca mevcut kayıtları atlar (slug/source+externalId).
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const db = new PrismaClient();
const CHUNK = 500;

function readJson(name) {
  const p = path.join(__dirname, "..", "prisma", "seed-data", name);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function insertChunked(model, rows, label) {
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const r = await model.createMany({ data: batch, skipDuplicates: true });
    total += r.count;
  }
  console.log(`  ${label}: ${total} eklendi (${rows.length} kayıttan; mevcutlar atlandı)`);
  return total;
}

(async () => {
  const events = readJson("events.json");
  const places = readJson("places.json");
  console.log(`Seed başlıyor: ${events.length} etkinlik, ${places.length} yer`);

  // ISO string DateTime alanlarını Prisma kabul eder; ayrıca güvenli olsun diye Date'e çeviriyoruz.
  const dateFields = ["startsAt", "endsAt", "lastScrapedAt", "createdAt", "updatedAt"];
  for (const e of events) for (const f of dateFields) if (e[f]) e[f] = new Date(e[f]);
  for (const p of places) for (const f of ["lastScrapedAt", "createdAt", "updatedAt"]) if (p[f]) p[f] = new Date(p[f]);

  if (events.length) await insertChunked(db.event, events, "Etkinlik");
  if (places.length) await insertChunked(db.place, places, "Yer");

  console.log("✔ Seed tamam.");
  await db.$disconnect();
})().catch(async (e) => {
  console.error("✖ Seed hatası:", e.message);
  await db.$disconnect();
  process.exit(1);
});
