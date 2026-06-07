/**
 * Instagram hashtag → etkinlik DENEME script'i.
 *
 *   npx tsx scripts/instagram-events.ts                 # varsayılan: kahve festivali
 *   npx tsx scripts/instagram-events.ts kahvefestivali coffeefest
 *
 * Gerekli env (.env.local'den otomatik okunur):
 *   IG_SESSIONID       — bir IG hesabının sessionid çerezi (DevTools → Cookies)
 *   ANTHROPIC_API_KEY  — vision çıkarımı için
 */
import { readFileSync } from "node:fs";

// tsx .env.local'i otomatik yüklemez — elle yükle.
function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* .env.local yoksa sorun değil */
  }
}
loadEnv();

const G = "\x1b[32m", R = "\x1b[31m", C = "\x1b[36m", GR = "\x1b[90m", B = "\x1b[1m", X = "\x1b[0m";

async function main() {
  const tags = process.argv.slice(2);
  const useTags = tags.length
    ? tags
    : ["kahvefestivali", "kahvefestival", "coffeefestival", "coffeefesttr"];

  console.log(`\n${B}☕ Instagram etkinlik denemesi${X}  hashtag'ler: ${C}${useTags.join(", ")}${X}\n`);

  if (!process.env.IG_SESSIONID) {
    console.log(`${R}✗ IG_SESSIONID yok.${X} .env.local'e ekle:`);
    console.log(`${GR}  1) instagram.com'a (burner hesapla) gir`);
    console.log(`  2) DevTools → Application → Cookies → instagram.com → "sessionid" değerini kopyala`);
    console.log(`  3) .env.local → IG_SESSIONID=...${X}\n`);
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.length < 20) {
    console.log(`${R}✗ ANTHROPIC_API_KEY geçersiz/eksik${X} (vision çıkarımı için gerekli).\n`);
    process.exit(1);
  }

  // server-only modülleri dinamik import et (env yüklendikten sonra).
  const { scrapeHashtagEvents } = await import("../src/lib/instagram/hashtagEvents");

  const t0 = Date.now();
  const { candidates, stats } = await scrapeHashtagEvents(useTags, { minConfidence: 0.55 });

  for (const c of candidates) {
    const d = c.event.startsAt.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
    console.log(`${G}✓${X} ${B}${c.extracted.title}${X}  ${GR}(${Math.round(c.extracted.confidence * 100)}%)${X}`);
    console.log(`   ${c.event.category} • ${d} • ${c.event.city || "?"} • ${c.event.venue}${c.event.isFree ? ` • ${G}ücretsiz${X}` : ""}`);
    console.log(`   ${GR}${c.post.permalink}${X}`);
  }

  console.log(`\n${B}─ Özet ─${X}`);
  console.log(`  ${C}${stats.postsSeen}${X} gönderi tarandı  →  ${G}${stats.eventsFound}${X} etkinlik adayı  ${GR}(${Date.now() - t0}ms)${X}`);
  if (stats.errors.length) {
    console.log(`  ${R}hatalar:${X}`);
    for (const e of stats.errors) console.log(`   ${GR}• ${e}${X}`);
  }
  console.log();
}

main().catch((e) => {
  console.error("Beklenmeyen hata:", e);
  process.exit(2);
});
