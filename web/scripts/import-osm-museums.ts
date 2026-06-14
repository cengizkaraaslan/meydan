/**
 * OpenStreetMap (Overpass) → belediye/özel müzeler dahil TÜM Türkiye müzelerini Place tablosuna
 * ekler. Kaynak "OSM". muze.gov.tr (Kültür Bakanlığı) yalnız resmi müzeleri kapsadığından eksik
 * kalan belediye/özel müzeleri (balmumu, cam, lületaşı…) tamamlar.
 *
 *   npx tsx scripts/import-osm-museums.ts --province "Eskişehir"   → tek il, KURU
 *   npx tsx scripts/import-osm-museums.ts                          → 81 il, KURU
 *   npx tsx scripts/import-osm-museums.ts --write                  → 81 il, Neon'a yaz (.env.dbpush)
 *
 * Görsel: OSM image tag → wikidata P18 (Commons) → wikimedia_commons tag → yoksa null (API placeholder).
 * Şehir: il area'sından KESİN (admin_level=4, Türkçe-karakter toleranslı regex). MUZE_GOV ile çakışan
 * (aynı ad+şehir) kayıtlar atlanır.
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
} catch {
  /* mevcut env */
}

const WRITE = process.argv.includes("--write");
const provArgIdx = process.argv.indexOf("--province");
const ONLY_PROVINCE = provArgIdx >= 0 ? process.argv[provArgIdx + 1] : null;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const PROVINCES = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir",
  "Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli",
  "Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari",
  "Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir",
  "Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir",
  "Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat",
  "Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman",
  "Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce",
];

const TR_SPECIAL = "şŞğĞüÜöÖçÇıİ";
/** İl adını Türkçe-karakter toleranslı, ankrajlı regex'e çevir (OSM area name eşleşmesi). */
function provinceRegex(name: string): string {
  const body = [...name]
    .map((ch) => (TR_SPECIAL.includes(ch) ? "." : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return `^${body}$`;
}

function foldTr(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ş/g, "s").replace(/Ş/g, "s").replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u").replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase().trim();
}
const normName = (s: string) => foldTr(s).replace(/[^a-z0-9]/g, "");
function slugify(s: string): string {
  return foldTr(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "yer";
}
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).slice(0, 6).padStart(6, "0");
}

function guessType(name: string): string {
  const n = name.toLocaleLowerCase("tr");
  if (/(saray|köşk|kosk|kasr)/.test(n)) return "SARAY";
  if (/(örenyeri|ören yeri|oren|antik|harabe|tümülüs|höyük|hoyuk)/.test(n)) return "OREN_YERI";
  return "MUZE";
}

interface OsmEl {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** OSM fee tag → "PAID" | "FREE" | null (bilinmiyor). */
function feeOf(tags: Record<string, string>): string | null {
  const f = (tags.fee || "").toLowerCase();
  if (f === "yes" || f === "ücretli" || f === "paid") return "PAID";
  if (f === "no" || f === "ücretsiz" || f === "free" || f === "donation") return "FREE";
  return null;
}

async function overpass(query: string): Promise<OsmEl[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429 || res.status === 504 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const json = (await res.json()) as { elements?: OsmEl[] };
      return json.elements ?? [];
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return [];
}

const wdCache = new Map<string, string | null>();
/** wikidata Q → Commons görsel URL (P18). */
async function wikidataImage(qid: string): Promise<string | null> {
  if (wdCache.has(qid)) return wdCache.get(qid)!;
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) { wdCache.set(qid, null); return null; }
    const json = (await res.json()) as any;
    const file = json?.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
    const url = file ? commonsUrl(file) : null;
    wdCache.set(qid, url);
    return url;
  } catch {
    wdCache.set(qid, null);
    return null;
  }
}
function commonsUrl(fileOrName: string): string {
  const name = fileOrName.replace(/^File:/i, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=900`;
}

async function imageFor(tags: Record<string, string>): Promise<string | null> {
  if (tags.image && /^https?:\/\//.test(tags.image)) return tags.image;
  if (tags.wikimedia_commons && /^File:/i.test(tags.wikimedia_commons)) return commonsUrl(tags.wikimedia_commons);
  if (tags.wikidata && /^Q\d+$/.test(tags.wikidata)) return await wikidataImage(tags.wikidata);
  return null;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

  // Çakışma kontrolü: mevcut tüm yerlerin normAd|şehir seti (MUZE_GOV dahil).
  const existing = await db.place.findMany({ select: { name: true, city: true, source: true, externalId: true } });
  const existKey = new Set(existing.map((e) => `${normName(e.name)}|${foldTr(e.city)}`));
  const osmIds = new Set(existing.filter((e) => e.source === "OSM").map((e) => e.externalId));

  const provinces = ONLY_PROVINCE ? [ONLY_PROVINCE] : PROVINCES;
  let found = 0, added = 0, skipped = 0, withImg = 0;
  const batchKeys = new Set<string>();

  for (const prov of provinces) {
    const q = `[out:json][timeout:80];area["admin_level"="4"]["name"~"${provinceRegex(prov)}"]->.a;nwr["tourism"="museum"](area.a);out center tags;`;
    const els = await overpass(q);
    let provAdded = 0;
    for (const el of els) {
      const tags = el.tags ?? {};
      const name = (tags["name:tr"] || tags.name || "").replace(/\s+/g, " ").trim();
      if (!name || name.length < 3) continue;
      found++;
      const key = `${normName(name)}|${foldTr(prov)}`;
      // MUZE_GOV ya da başka kaynakla çakışan / bu batch'te tekrar → atla.
      if (existKey.has(key) || batchKeys.has(key)) { skipped++; continue; }
      batchKeys.add(key);
      const externalId = `osm-${el.type}-${el.id}`;
      const img = await imageFor(tags);
      if (img) withImg++;
      const lat = el.lat ?? el.center?.lat ?? null;
      const lng = el.lon ?? el.center?.lon ?? null;
      const fee = feeOf(tags);
      if (WRITE) {
        const type = guessType(name);
        const website = tags.website || tags["contact:website"] || null;
        await db.place.upsert({
          where: { source_externalId: { source: "OSM", externalId } },
          create: {
            source: "OSM", externalId, slug: `yer-${slugify(name)}-${shortHash(externalId)}`,
            name, type, city: prov, imageUrl: img, website, lat, lng, fee, lastScrapedAt: new Date(),
          },
          // Var olan satırda: koordinat/fee/görsel doluysa güncelle (boşla ezme).
          update: {
            name, city: prov, type,
            ...(img ? { imageUrl: img } : {}),
            ...(website ? { website } : {}),
            ...(lat != null ? { lat } : {}),
            ...(lng != null ? { lng } : {}),
            ...(fee ? { fee } : {}),
          },
        });
      }
      added++;
      provAdded++;
    }
    console.log(`${prov}: OSM müze=${els.length} · yeni=${provAdded}`);
    await new Promise((r) => setTimeout(r, 800)); // Overpass'a nazik ol
  }

  console.log(`\nBitti. Bulunan=${found} · eklenecek/eklendi=${added} · çakışma-atlandı=${skipped} · gerçek görsel=${withImg}. ${WRITE ? "DB yazıldı." : "(KURU — --write ile yaz)"}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
