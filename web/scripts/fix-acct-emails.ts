/**
 * MobileProfile.email'i "acct:x@y" biçiminde bozuk kaydedilmiş satırları düzeltir → "x@y".
 * (Profile route'taki "@ önce acct: kontrolü" hatası yüzünden oluşmuştu; route düzeltildi.)
 *   npx tsx scripts/fix-acct-emails.ts
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
  const rows = await db.mobileProfile.findMany({
    where: { email: { startsWith: "acct:" } },
    select: { deviceId: true, email: true },
  });
  console.log(`Bozuk email (acct: önekli): ${rows.length}`);
  let fixed = 0;
  for (const r of rows) {
    const clean = (r.email as string).slice(5).toLowerCase();
    try {
      await db.mobileProfile.update({ where: { deviceId: r.deviceId }, data: { email: clean } });
      fixed++;
    } catch (e) {
      // email @unique olabilir → çakışırsa atla (zaten doğru kayıt var)
      console.warn(`atlandı ${r.deviceId}:`, e instanceof Error ? e.message.split("\n")[0] : e);
    }
  }
  console.log(`Düzeltilen: ${fixed}/${rows.length}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
