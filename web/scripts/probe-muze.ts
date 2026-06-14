/**
 * DENEME scraper — Kültür ve Turizm Bakanlığı resmi müze portalı (muze.gov.tr).
 *
 * Amaç: müze.gov.tr'den biletli/MüzeKart müzelerini + örenyerlerini çekip JSON dökmek.
 * Henüz EVENT modeline (ScrapedEvent/startsAt) bağlanmadı — müzeler "etkinlik" değil
 * KALICI yer. Önce veriyi görüp doğru veri modeline karar vereceğiz (kullanıcı: "sadece müze").
 *
 * Kaynak yapısı (SSR HTML, JS gerekmez):
 *   - https://muze.gov.tr/sitemap.xml          → tüm /muze-detay?SectionId=..&DistId=.. URL'leri
 *   - https://muze.gov.tr/muzeler              → öne çıkan müze linkleri (sitemap'i tamamlar)
 *   - /muze-detay?SectionId=..&DistId=..        → og:title (ad), og:image (görsel),
 *                                                 og:description, "Adres:" bloğu, "Saati: HH:MM"
 *   TR içerik için önce /Language/Index/TR ziyaret edilip cookie alınır.
 *
 * Çalıştır:  npx tsx scripts/probe-muze.ts
 * Çıktı:     scripts/out/muze.json  +  konsol özeti
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://muze.gov.tr";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

interface Museum {
  externalId: string;       // SectionId
  distId: string;
  name: string;
  city?: string;
  address?: string;
  description?: string;
  imageUrl?: string;
  openTime?: string;        // "08:30"
  closeTime?: string;       // "19:00"
  detailUrl: string;
}

// Türkiye illeri (il adı tespiti için). BaseScraper.normalizeCity ile uyumlu kısa liste yeter.
const CITIES = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan",
  "Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu",
  "Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ",
  "Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır",
  "Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri",
  "Kırıkkale","Kırklareli","Kırşehir","Kilis","Kocaeli","Konya","Kütahya","Malatya","Manisa",
  "Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun",
  "Siirt","Sinop","Sivas","Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van",
  "Yalova","Yozgat","Zonguldak",
];

async function getCookie(): Promise<string> {
  const res = await fetch(`${BASE}/Language/Index/TR?url=%2Fmuzeler`, {
    headers: { "User-Agent": UA },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  const sc = res.headers.get("set-cookie") ?? "";
  // İlk cookie segmentlerini birleştir (";" öncesi kısımlar)
  return sc.split(/,(?=[^;]+=)/).map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

async function get(url: string, cookie: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "tr-TR,tr;q=0.9",
      Accept: "text/html,application/xhtml+xml",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

/** sitemap + /muzeler sayfasından benzersiz {SectionId,DistId} çiftlerini topla. */
async function collectUrls(cookie: string): Promise<Array<{ sectionId: string; distId: string }>> {
  const seen = new Map<string, { sectionId: string; distId: string }>();
  for (const page of ["/sitemap.xml", "/muzeler"]) {
    let html = "";
    try {
      html = await get(BASE + page, cookie);
    } catch {
      continue;
    }
    const re = /muze-detay\?SectionId=([A-Z0-9]+)&(?:amp;)?DistId=([A-Z0-9]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const sectionId = m[1].toUpperCase();
      const distId = m[2].toUpperCase();
      seen.set(`${sectionId}|${distId}`, { sectionId, distId });
    }
  }
  return [...seen.values()];
}

function pickCity(text: string): string | undefined {
  // Adres metninde geçen ilk il adını döndür (uzun adlar önce: Afyonkarahisar > Afyon yok zaten).
  const hay = text.toLocaleUpperCase("tr");
  for (const c of [...CITIES].sort((a, b) => b.length - a.length)) {
    if (hay.includes(c.toLocaleUpperCase("tr"))) return c;
  }
  return undefined;
}

function parseDetail(html: string, sectionId: string, distId: string): Museum {
  const $ = cheerio.load(html);
  const og = (p: string) => $(`meta[property='og:${p}']`).attr("content")?.trim() || undefined;

  const name = (og("title") || $("h1").first().text() || "").replace(/\s+/g, " ").trim();
  const description = og("description");
  const imageUrl = og("image");

  // "Adres:" etiketinden sonraki metin bloğu
  const bodyText = $("body").text().replace(/\s+/g, " ");
  let address: string | undefined;
  const am = bodyText.match(/Adres\s*:?\s*([^|]{5,160}?)(?:Ziyaret|Telefon|Tel\b|Saat|$)/i);
  if (am) address = am[1].trim().replace(/[\s,;]+$/, "");

  // Ziyaret saatleri: "Saati: 08:30" gibi tüm eşleşmeler — ilk açılış, en geç kapanış kabul
  const times = [...html.matchAll(/Saati?\s*:?\s*([0-9]{1,2})[:.]([0-9]{2})/gi)]
    .map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
  const openTime = times[0];
  const closeTime = times.length > 1 ? times[times.length - 1] : undefined;

  const city = pickCity(`${address ?? ""} ${name}`);

  return {
    externalId: sectionId,
    distId,
    name,
    city,
    address,
    description,
    imageUrl,
    openTime,
    closeTime,
    detailUrl: `${BASE}/muze-detay?SectionId=${sectionId}&DistId=${distId}`,
  };
}

async function main() {
  const cookie = await getCookie();
  const urls = await collectUrls(cookie);
  console.log(`Bulunan müze-detay URL'i: ${urls.length}`);

  const out: Museum[] = [];
  for (let i = 0; i < urls.length; i++) {
    const { sectionId, distId } = urls[i];
    try {
      const html = await get(`${BASE}/muze-detay?SectionId=${sectionId}&DistId=${distId}`, cookie);
      const m = parseDetail(html, sectionId, distId);
      if (m.name) out.push(m);
      process.stdout.write(`\r  çekiliyor ${i + 1}/${urls.length}  (${out.length} ok)   `);
    } catch (e) {
      process.stdout.write(`\r  HATA ${sectionId}: ${(e as Error).message}\n`);
    }
    await new Promise((r) => setTimeout(r, 400)); // nazik gecikme
  }
  console.log("");

  const dir = path.join(process.cwd(), "scripts", "out");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "muze.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2), "utf8");

  // Özet
  const byCity: Record<string, number> = {};
  for (const m of out) byCity[m.city ?? "?"] = (byCity[m.city ?? "?"] || 0) + 1;
  console.log(`\nToplam müze: ${out.length}  → ${file}`);
  console.log("İl dağılımı:", byCity);
  console.log("Saat dolu:", out.filter((m) => m.openTime).length, "/ Görsel dolu:", out.filter((m) => m.imageUrl).length, "/ Adres dolu:", out.filter((m) => m.address).length);
  console.log("\nÖrnek 3 kayıt:");
  console.log(JSON.stringify(out.slice(0, 3), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
