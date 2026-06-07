import { FestivallTrScraper } from "../src/lib/scrapers/providers/FestivallTrScraper";

async function main() {
  console.log("\n🎪 FestivallTr scraper test\n");
  const scraper = new FestivallTrScraper();
  const t0 = Date.now();
  const result = await scraper.run();
  const dur = Date.now() - t0;

  console.log(`✓ Sonuç: ${result.success ? "başarılı" : "BAŞARISIZ"}  (${dur}ms)`);
  console.log(`  Toplam etkinlik: ${result.events.length}`);
  if (result.errorMessage) console.log(`  Hata: ${result.errorMessage}`);

  // İlk 10 etkinlik örnek
  for (const ev of result.events.slice(0, 10)) {
    const date = ev.startsAt.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    console.log(`  • [${ev.city}] ${ev.title}  —  ${date}`);
    if (ev.imageUrl) console.log(`    img: ${ev.imageUrl.slice(0, 80)}`);
  }

  // Şehir dağılımı
  const cityCount = new Map<string, number>();
  for (const ev of result.events) {
    cityCount.set(ev.city, (cityCount.get(ev.city) ?? 0) + 1);
  }
  const top = [...cityCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\n  Top 15 şehir:`);
  for (const [city, n] of top) {
    console.log(`    ${city.padEnd(15)} ${n}`);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Hata:", err);
  process.exit(2);
});
