// Headless Playwright ile JS-render kurs sitelerinden branş çek (KAYMEK, GASMEK, ESMEK).
// Lokal/bakım zamanı çalışır; çıktı src/data/courses-snapshot.json'a yazılır.
// Çalıştır: node scripts/scrape-courses-pw.mjs
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

// ASCII-katlanmış metne karşı test edilir (JS /i Türkçe büyük harfi foldlamaz).
const NOISE = /^menu|iletisim|anasayfa|giris|kayit|hakk|duyuru|haber|tum haklar|copyright|cerez|cookie|^ara$|devam|detay|^kurslar$|^branslar$|galeri|birim|yayin|referans|^tumu$|^ana sayfa$|bilgi ve|^sayfa$|kurumsal|medya|^logo$|facebook|instagram|twitter|youtube|akilli arama|bizi takip|uye ol|uye giris|egitmen|merkez|sanat galeri|^kaymek|^genc kaymek|katilmak|aram|takip|^egitimler?$/;

function fold(s) {
  return s
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ş/g, "s").replace(/Ş/g, "s").replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u").replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase().trim();
}

function clean(arr) {
  const seen = new Set();
  const out = [];
  for (const r of arr) {
    const t = (r || "").replace(/\s+/g, " ").replace(/\(\s*\d+\s*\)\s*$/, "").trim();
    if (t.length < 3 || t.length > 60) continue;
    const f = fold(t);
    if (NOISE.test(f)) continue;
    if (!/[a-z]/.test(f)) continue;
    if (seen.has(f)) continue;
    seen.add(f);
    out.push(t);
  }
  return out;
}

async function extract(page, selectors) {
  const texts = await page.evaluate((sels) => {
    const acc = [];
    for (const s of sels) {
      document.querySelectorAll(s).forEach((el) => acc.push(el.textContent || ""));
    }
    return acc;
  }, selectors);
  return clean(texts);
}

const TARGETS = [
  {
    key: "GASMEK",
    url: "https://gasmek.gaziantep.bel.tr/branches",
    waitFor: ".product__item__title",
    cardMode: ".product__item", // ad + görsel
  },
  {
    key: "KAYMEK",
    url: "https://www.kaymekonline.com/egitimler",
    waitFor: "body",
    selectors: [".card-title", ".egitim-adi", ".course-title", ".kurs-adi", "h3", "h4", "h5", ".card h3", "a[href*='egitim']"],
  },
  {
    key: "ESMEK",
    url: "https://esmek.eskisehir.bel.tr/onkayit.php",
    iframe: /eski_/, // kayıt tablosu /eski_/onkayit.php iframe'inde
    rowMode: true, // tablo satırlarından kurs adı çıkar (merkez/tarih/durum ele)
  },
];

// ESMEK kayıt tablosu hücrelerinden kurs adı OLMAYANLARI ele
const ESMEK_DROP = /eğitim merkezi|oyun evi|kütüphane|^\d{2}\.\d{2}\.\d{4}$|\d{1,2}:\d{2}|kayıt alıyor|^dolu$|kapalı|^(pzt|sal|çar|per|cum|cmt|paz)[: ]/i;

const result = {};
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  locale: "tr-TR",
});

for (const t of TARGETS) {
  const page = await ctx.newPage();
  try {
    await page.goto(t.url, { waitUntil: "networkidle", timeout: 45000 });
    if (t.waitFor) {
      try {
        await page.waitForSelector(t.waitFor, { timeout: 12000 });
      } catch {
        /* selector gelmedi, yine de dene */
      }
    }
    await page.waitForTimeout(3500);

    let courses;
    if (t.rowMode) {
      // iframe içindeki kayıt tablosu: 8 sütun [merkez, branş, başlama, bitiş, saatler, açıklama, durum, önkayıt]
      const frame = t.iframe ? page.frames().find((f) => t.iframe.test(f.url())) : page.mainFrame();
      const rows = frame
        ? await frame.evaluate(() =>
            [...document.querySelectorAll("table tr")]
              .map((tr) => [...tr.querySelectorAll("td")].map((td) => (td.textContent || "").replace(/\s+/g, " ").trim()))
              .filter((c) => c.length === 8 && c[1] !== "Branş Adı" && !/ARAMA:/.test(c[0])),
          )
        : [];
      const seen = new Set();
      courses = [];
      for (const c of rows) {
        const [center, name, start, end, schedule, note, durum, onkayit] = c;
        if (!name || name.length < 3 || name.length > 60) continue;
        const key = `${name}|${center}|${start}`;
        if (seen.has(key)) continue;
        seen.add(key);
        courses.push({
          name,
          center: center || undefined,
          start: start || undefined,
          end: end || undefined,
          schedule: schedule || undefined,
          note: note || undefined,
          full: /dolu/i.test(durum || ""),
          open: /kay[ıi]t al[ıi]yor/i.test(onkayit || ""),
        });
      }
    } else if (t.cardMode) {
      // kart-bazlı: ad + görsel (background-image ya da img)
      const raw = await page.evaluate((sel) => {
        return [...document.querySelectorAll(sel)].map((card) => {
          const titleEl = card.querySelector(".product__item__title, h3, h4, .title");
          const name = (titleEl?.textContent || "").replace(/\s+/g, " ").trim();
          const imgEl = card.querySelector("img");
          let image = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
          if (!image) {
            const bg = card.querySelector("[style*='background']");
            const m = bg && (bg.getAttribute("style") || "").match(/url\(['"]?([^'")]+)['"]?\)/);
            if (m) image = m[1];
          }
          return { name, image };
        });
      }, t.cardMode);
      const seen = new Set();
      courses = [];
      for (const r of raw) {
        const name = (r.name || "").replace(/\s+/g, " ").trim();
        if (name.length < 3 || name.length > 60) continue;
        if (NOISE.test(fold(name))) continue;
        if (seen.has(fold(name))) continue;
        seen.add(fold(name));
        courses.push({ name, image: r.image || undefined });
      }
      result[t.key] = courses;
      console.log(`${t.key}: ${courses.length} branş (görselli) -> ${courses.slice(0, 5).map((c) => c.name).join(", ")} …`);
      continue;
    } else {
      courses = await extract(page, t.selectors);
    }
    result[t.key] = courses;
    if (t.rowMode) {
      console.log(`${t.key}: ${courses.length} kayıt`);
      continue;
    }
    console.log(`${t.key}: ${courses.length} branş -> ${courses.slice(0, 8).join(", ")}${courses.length > 8 ? " …" : ""}`);
  } catch (e) {
    result[t.key] = [];
    console.log(`${t.key}: HATA ${e.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/courses-snapshot.json", JSON.stringify({ scrapedAt: new Date().toISOString(), data: result }, null, 2) + "\n");
console.log("\n✓ src/data/courses-snapshot.json yazıldı");
