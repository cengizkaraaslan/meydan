/**
 * TÜM scraper'ları (rotasyon/bütçe limiti OLMADAN) çalıştırıp sonuçları canlı Neon'a yazar.
 * Cron/admin rotasyonun aksine tek seferde 109 kaynağın hepsini tarar. Yerelden elle tetik:
 *   vercel env pull .env.scrape.local --environment=production
 *   npx tsx --conditions=react-server scripts/run-all-persist.ts
 */
import fs from "node:fs";

// 1) Prod env'i (DATABASE_URL, R2, anahtarlar) db/Prisma import'undan ÖNCE yükle.
const ENV_FILE = process.env.SCRAPE_ENV_FILE ?? ".env.scrape.local";
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
// 2) Canlı fetch + rotasyon yok (hepsi) + bol bütçe.
process.env.USE_MOCK_DATA = "false";
process.env.SCRAPE_MAX_SOURCES = process.env.SCRAPE_MAX_SOURCES ?? "999";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL yok — önce `vercel env pull .env.scrape.local --environment=production`");
    process.exit(2);
  }
  // db/Prisma'yı env hazır OLDUKTAN sonra dinamik yükle.
  const { runAndPersistAll } = await import("../src/lib/scrapers/runAndPersist");

  const t0 = Date.now();
  console.log("Tüm kaynaklar çalışıyor (canlı, Neon'a yazılıyor)…\n");
  const results = await runAndPersistAll({ budgetMs: 30 * 60_000, concurrency: 8 });

  const sorted = [...results].sort((a, b) => b.eventCount - a.eventCount);
  let ok = 0, fail = 0, events = 0, written = 0;
  for (const r of sorted) {
    r.success ? ok++ : fail++;
    events += r.eventCount;
    written += r.written;
    const status = r.success ? "✓" : "✗";
    console.log(
      `  ${status} ${r.source.padEnd(22)} ${String(r.eventCount).padStart(3)} etkinlik  →  ${String(r.written).padStart(3)} yazıldı  (${r.durationMs}ms)` +
      (r.error ? `  ERR: ${r.error}` : ""),
    );
  }
  console.log(
    `\n─ Özet ─  ${ok} başarılı / ${fail} başarısız / ${results.length} kaynak  •  ` +
    `${events} etkinlik bulundu, ${written} DB'ye yazıldı  •  ${Math.round((Date.now() - t0) / 1000)}sn`,
  );
  process.exit(0);
}

main().catch((e) => { console.error("Beklenmeyen hata:", e); process.exit(1); });
