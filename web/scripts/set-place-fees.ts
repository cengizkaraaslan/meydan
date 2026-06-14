/**
 * muze.gov.tr (MUZE_GOV) müzeleri MüzeKart kapsamında ücretlidir → fee="PAID".
 *   npx tsx scripts/set-place-fees.ts
 */
import fs from "node:fs";
try {
  const txt = fs.readFileSync(".env.dbpush", "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} catch { /* env */ }

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const r = await db.place.updateMany({ where: { source: "MUZE_GOV" }, data: { fee: "PAID" } });
  console.log(`MUZE_GOV fee=PAID güncellendi: ${r.count}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
