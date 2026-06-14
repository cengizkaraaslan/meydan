/**
 * Müze/yer görsellerini GERÇEK muze.gov.tr detay görseliyle (og:image → /s3/SectionPicture)
 * doldurur. DB'de imageUrl'i NULL olan (API jenerik Unsplash gösteriyor) MUZE_GOV kayıtlarını
 * günceller. Detay og:image cookie gerektirmeden çalışır ve /s3/ görselleri uygulamada yüklenir.
 *
 *   npx tsx scripts/backfill-place-images.ts            → kuru (yazmaz), isabet oranını gösterir
 *   npx tsx scripts/backfill-place-images.ts --write     → Place.imageUrl güncelle (.env.dbpush direct host)
 *   npx tsx scripts/backfill-place-images.ts --write --all → NULL olmasa da (unsplash dahil) hepsini tazele
 */
import fs from "node:fs";

// .env.dbpush (direct, non-pooler Neon host) yükle — test-muze.ts ile aynı desen.
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
  /* .env.dbpush yoksa mevcut ortam değişkenleriyle dene */
}

const WRITE = process.argv.includes("--write");
const ALL = process.argv.includes("--all");
const BASE = "https://muze.gov.tr";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** Detay sayfasından gerçek müze fotoğrafı (og:image, /s3/) — yoksa null. */
async function realImage(externalId: string, distId: string | null): Promise<string | null> {
  const url = `${BASE}/muze-detay?SectionId=${externalId}&DistId=${distId ?? ""}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const img = m?.[1]?.trim();
    // Yalnız gerçek müze fotoğrafı (/s3/) — jenerik kapak (cover_about-us / img/) değil.
    return img && /\/s3\//.test(img) ? img : null;
  } catch {
    return null;
  }
}

async function main() {
  const { db } = await import("../src/lib/db");
  const where = ALL
    ? { source: "MUZE_GOV" }
    : { source: "MUZE_GOV", imageUrl: null };
  const rows = await db.place.findMany({
    where,
    select: { id: true, externalId: true, distId: true, name: true },
  });
  console.log(`Hedef ${rows.length} yer (mod: ${ALL ? "tümü" : "yalnız NULL"}, WRITE=${WRITE})`);

  let ok = 0,
    miss = 0,
    done = 0;
  const CONC = 6;
  let idx = 0;
  async function worker() {
    while (idx < rows.length) {
      const r = rows[idx++];
      const img = await realImage(r.externalId, r.distId);
      done++;
      if (img) {
        ok++;
        if (WRITE) await db.place.update({ where: { id: r.id }, data: { imageUrl: img } });
      } else {
        miss++;
      }
      if (done % 25 === 0 || done === rows.length) {
        console.log(`[${done}/${rows.length}] gerçek görsel: ${ok} · bulunamadı: ${miss} · son: ${r.name}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));

  console.log(
    `\nBitti. Gerçek görsel bulunan: ${ok} / ${rows.length} (bulunamayan: ${miss}). ${
      WRITE ? "DB güncellendi." : "(KURU — yazmak için --write ekle)"
    }`,
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
