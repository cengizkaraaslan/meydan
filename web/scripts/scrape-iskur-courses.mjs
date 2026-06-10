// İŞKUR "Yayındaki Kurslar" (KursOnAir) — Playwright ile ülke geneli açık kurs/İEP
// programlarını çeker. Her kayıt KENDİ İl/İlçesini taşır (lokasyon filtresi için).
// Lokal/bakım zamanı çalışır; çıktı: src/data/iskur-snapshot.json
// Çalıştır:  cd web && node scripts/scrape-iskur-courses.mjs
//
// Kaynak ASP.NET/AjaxPro: KursOnAir.aspx → İl=Türkiye (varsayılan) + "Ara" → tek grid.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const URL = "https://esube.iskur.gov.tr/Kurs/KursOnAir.aspx";

/** "dd.mm.yyyy" → ISO (yyyy-mm-dd). Geçersizse undefined. */
function trDateToIso(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((s || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(40000);
  const items = [];
  try {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // İl=Türkiye (varsayılan) ile ülke geneli ara.
    await page.click("#ctl05_PageCommand1_CommandItem_Search");
    await page.waitForTimeout(8000);

    const rows = await page.evaluate(() => {
      const g = document.querySelector("#ctl05_ctlAnaGrid");
      if (!g) return [];
      return [...g.querySelectorAll("tr")]
        .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim()))
        .filter((r) => r.length >= 8 && /\d{2}\.\d{2}\.\d{4}/.test(r.join(" ")));
    });

    // Sütunlar: KursNo, İl, İlçe, Meslek, Başlangıç, SonBaşvuru, Statü, KursTürü, BaşvuruDurumu
    const seen = new Set();
    for (const r of rows) {
      const [kursNo, il, ilce, meslek, basla, sonBasvuru, statu, kursTur] = r;
      if (!meslek || !il) continue;
      const city = (il || "").toLocaleLowerCase("tr").replace(/^./, (c) => c.toLocaleUpperCase("tr"));
      const district = ilce ? ilce.toLocaleLowerCase("tr").replace(/^./, (c) => c.toLocaleUpperCase("tr")) : undefined;
      const name = meslek.replace(/\s+/g, " ").trim();
      const key = `${kursNo}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const noteParts = [];
      if (kursTur) noteParts.push(kursTur.replace(/\s+/g, " ").trim());
      if (statu) noteParts.push(statu);
      if (sonBasvuru) noteParts.push(`Son başvuru: ${sonBasvuru}`);
      if (kursNo) noteParts.push(`Kurs No: ${kursNo}`);
      items.push({
        name,
        city: cityName(il),
        district,
        start: trDateToIso(basla),
        schedule: sonBasvuru ? `Son başvuru ${sonBasvuru} · Başlangıç ${basla}` : `Başlangıç ${basla}`,
        note: noteParts.join(" · "),
        open: /açıl|başvur/i.test(statu || "") && !/dolu/i.test(statu || ""),
        url: "https://esube.iskur.gov.tr/Kurs/KursOnAir.aspx",
      });
    }
  } finally {
    await browser.close();
  }

  mkdirSync("src/data", { recursive: true });
  const out = { generatedAt: new Date().toISOString(), count: items.length, data: { ISKUR: items } };
  writeFileSync("src/data/iskur-snapshot.json", JSON.stringify(out, null, 2));
  console.log(`İŞKUR: ${items.length} kurs/program yazıldı → src/data/iskur-snapshot.json`);
  const byCity = {};
  for (const it of items) byCity[it.city] = (byCity[it.city] || 0) + 1;
  console.log("İl dağılımı:", JSON.stringify(byCity));
}

/** İl adını Türkçe başlık biçimine getir (TOKAT → Tokat, İSTANBUL → İstanbul). */
function cityName(raw) {
  const s = (raw || "").trim();
  if (!s) return s;
  // Tümü büyükse başlık-case'e çevir (Türkçe-duyarlı i/İ).
  return s
    .toLocaleLowerCase("tr")
    .split(/(\s+|-)/)
    .map((w) => (/^\s+$|^-$/.test(w) ? w : w.replace(/^./, (c) => c.toLocaleUpperCase("tr"))))
    .join("");
}

run().catch((e) => {
  console.error("İŞKUR scrape hatası:", e.message);
  process.exit(1);
});
