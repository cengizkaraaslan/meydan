/**
 * Müze scraper testi + ilk doldurma.
 *
 *   npx tsx scripts/test-muze.ts            → kuru tarama (DB'ye YAZMAZ): 81 il sayımı + örnek
 *   npx tsx scripts/test-muze.ts --write     → tam çek + Place tablosuna yaz (.env.dbpush direct host)
 *   npx tsx scripts/test-muze.ts --write --fast  → detaysız hızlı yaz (sadece ad+il)
 */
import fs from "node:fs";

// .env.dbpush'u (CRLF dahil) yükle — direct (non-pooler) Neon host'u.
try {
  const txt = fs.readFileSync(".env.dbpush", "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} catch {
  /* env dosyası yoksa mevcut env ile devam */
}

const WRITE = process.argv.includes("--write");
const FAST = process.argv.includes("--fast");

async function main() {
  const { MuzeScraper } = await import("../src/lib/scrapers/providers/MuzeScraper");
  const scraper = new MuzeScraper();

  console.log(`Müze scraper başlıyor (write=${WRITE}, fast=${FAST})...`);
  const t0 = Date.now();
  const result = await scraper.run({ fetchDetails: !FAST, detailConcurrency: 8 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\nsüre: ${secs}s · başarı: ${result.success} · toplam yer: ${result.places.length}`);
  if (result.errorMessage) console.log("HATA:", result.errorMessage);

  const byCity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const p of result.places) {
    byCity[p.city] = (byCity[p.city] || 0) + 1;
    byType[p.type] = (byType[p.type] || 0) + 1;
  }
  console.log(`il sayısı: ${Object.keys(byCity).length} / 81`);
  console.log("tür dağılımı:", byType);
  console.log("saat dolu:", result.places.filter((p) => p.openTime).length,
    "/ görsel dolu:", result.places.filter((p) => p.imageUrl).length,
    "/ adres dolu:", result.places.filter((p) => p.address).length);
  console.log("\nörnek 3:", JSON.stringify(result.places.slice(0, 3), null, 2));

  if (WRITE) {
    const { setPlacesForSource } = await import("../src/lib/scrapers/PlaceCache");
    const r = await setPlacesForSource(result.source, result.places);
    console.log(`\nDB yazımı → yazılan: ${r.written}, yeni: ${r.created}, güncellenen: ${r.updated}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
