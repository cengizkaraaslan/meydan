import { scraperRegistry } from "../src/lib/scrapers/ScraperRegistry";
import { SOURCE_LABELS } from "../src/lib/types";

const PURPLE = "\x1b[35m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

async function main() {
  const useMock = process.env.USE_MOCK_DATA !== "false";
  const mode = useMock ? `${GRAY}MOCK${RESET}` : `${GREEN}LIVE${RESET}`;
  console.log(`\n${BOLD}${PURPLE}╭─ EtkinlikScout scraper test (${mode}) ───────────╮${RESET}\n`);

  const results = await scraperRegistry.runAll();

  let totalEvents = 0;
  let totalOk = 0;
  let totalFail = 0;

  for (const r of results) {
    const dur = r.finishedAt.getTime() - r.startedAt.getTime();
    const status = r.success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const count = r.events.length;
    totalEvents += count;
    if (r.success) totalOk++;
    else totalFail++;

    console.log(
      `  ${status} ${BOLD}${SOURCE_LABELS[r.source]}${RESET} ${GRAY}(${r.source})${RESET}  ${CYAN}${count}${RESET} etkinlik  ${GRAY}${dur}ms${RESET}`,
    );

    if (r.errorMessage) {
      console.log(`     ${RED}error:${RESET} ${r.errorMessage}`);
    }

    if (r.events[0]) {
      const e = r.events[0];
      const date = e.startsAt.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
      const price = e.isFree ? "Ücretsiz" : `${e.priceMin ?? "?"}-${e.priceMax ?? "?"}₺`;
      console.log(`     ${GRAY}örnek:${RESET} "${e.title.slice(0, 60)}"  ${GRAY}•${RESET}  ${date}  ${GRAY}•${RESET}  ${price}`);
    }
    console.log();
  }

  console.log(`${BOLD}─ Özet ─────────────────────────────────────${RESET}`);
  console.log(`  ${GREEN}${totalOk}${RESET} başarılı  ${RED}${totalFail}${RESET} başarısız  ${CYAN}${totalEvents}${RESET} toplam etkinlik`);
  console.log(`${BOLD}${PURPLE}╰──────────────────────────────────────────────╯${RESET}\n`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(2);
});
