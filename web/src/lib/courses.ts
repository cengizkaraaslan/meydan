import * as cheerio from "cheerio";
import { unstable_cache } from "next/cache";
import { slugify } from "./utils";
// JS-render siteler (GASMEK vb.) için Playwright ile alınmış branş snapshot'ı.
// Yenilemek için: node scripts/scrape-courses-pw.mjs
import snapshot from "../data/courses-snapshot.json";
// İŞKUR yayındaki kurs/İEP programları (ülke geneli, kurs-başına İl/İlçe).
// Yenilemek için: node scripts/scrape-iskur-courses.mjs
import iskurSnapshot from "../data/iskur-snapshot.json";

export interface CourseProvider {
  key: string;
  name: string;
  city: string;
  /** Branş/kurs listesinin bulunduğu SSR sayfa */
  listUrl: string;
  /** Kullanıcının ön kayıt/başvuru yapacağı sayfa */
  registerUrl: string;
  /** Kurs adını taşıyan elemanların CSS selector'ı */
  selector: string;
  /** Görselli kart için: her kartı saran selector (varsa kart-bazlı çekim + görsel) */
  cardSelector?: string;
  /** Kart içindeki ad selector'ı (cardSelector ile birlikte) */
  nameInCard?: string;
  /** Ülke geneli kaynak (İŞKUR/MEB): tek şehir değil, kurslar KENDİ şehrini taşır. */
  national?: boolean;
}

/** Bir kurs/branş kaydı — sadece ad ya da merkez/tarih/saat/doluluk içeren zengin kayıt. */
export interface CourseItem {
  name: string;
  center?: string;
  start?: string;
  end?: string;
  schedule?: string;
  note?: string;
  image?: string; // branş görseli (KOMEK/GASMEK/İZMEK)
  full?: boolean; // DOLU
  open?: boolean; // Kayıt Alıyor
  /** Ulusal kaynaklarda (İŞKUR) kursun ili — lokasyon filtresi bunu kullanır. */
  city?: string;
  /** Kursun ilçesi (İŞKUR). */
  district?: string;
  /** Kursa özel başvuru/detay bağlantısı (İŞKUR). */
  url?: string;
}

export interface CourseGroup {
  provider: CourseProvider;
  courses: CourseItem[];
}

/**
 * Belediye ÜCRETSİZ KURS (meslek/sanat edindirme) kaynakları — recon ile SSR doğrulandı.
 * Etkinliklerden AYRI; /kurslar sayfasında listelenir. ESMEK kayıt dönemi kapalıyken
 * boş döner (kayıt açılınca dolar).
 */
export const COURSE_PROVIDERS: CourseProvider[] = [
  {
    key: "ESMEK",
    name: "ESMEK — Eskişehir Belediyesi",
    city: "Eskişehir",
    listUrl: "https://esmek.eskisehir.bel.tr/onkayit.php",
    registerUrl: "https://esmek.eskisehir.bel.tr/onkayit.php",
    // onkayit.php placeholder (kurs listesi kayıt dönemi açılınca branslar_dvm.php'de gelir).
    // Sadece gerçek branş elemanlarını hedefle; şu an boş döner → "kayıt kapalı" linkine düşer.
    selector: "select[name*='brans'] option, .brans-list a, .kurs-adi, a[href*='branslar_dvm']",
  },
  {
    key: "GASMEK",
    name: "GASMEK — Gaziantep Büyükşehir",
    city: "Gaziantep",
    listUrl: "https://gasmek.gaziantep.bel.tr/branches",
    registerUrl: "https://gasmek.gaziantep.bel.tr",
    selector: "ul li a, .branch h3, h3",
  },
  {
    key: "KOMEK",
    name: "KOMEK — Konya Büyükşehir",
    city: "Konya",
    listUrl: "https://www.komek.org/branslar",
    registerUrl: "https://www.komek.org",
    selector: "h3",
    cardSelector: "a[href*='/branslar/ListDetay/']",
    nameInCard: "h3",
  },
  {
    key: "IZMEK",
    name: "İZMEK — İzmir Meslek Edindirme",
    city: "İzmir",
    // /branslar sadece 6 kategori veriyordu; /kategori/kurslar bireysel kursları listeler.
    listUrl: "https://www.izmek.com/kategori/kurslar",
    registerUrl: "https://www.izmek.com",
    selector: ".branch h3, .card h3, h3",
  },
  {
    key: "KAYMEK",
    name: "KAYMEK — Kayseri Büyükşehir",
    city: "Kayseri",
    listUrl: "https://kaymek.com.tr/tr/20920/Kurslar.html",
    registerUrl: "https://kaymek.com.tr",
    selector: "h4 a, h4, .kurs h3",
  },
  {
    key: "BELMEK",
    name: "BELMEK — Ankara Büyükşehir",
    city: "Ankara",
    // /tumbranslar düz HTML — branş adları .course-title + /brans/ linklerinde.
    // (WebFetch'e 403 verir ama fetchProvider gerçek Chrome UA gönderir → 200.)
    listUrl: "https://belmek.ankara.bel.tr/tumbranslar",
    registerUrl: "https://belmek.ankara.bel.tr/",
    selector: ".course-title, a[href*='/brans/']",
  },
  {
    key: "BURSA",
    name: "Bursa Akademi — Bursa Büyükşehir",
    city: "Bursa",
    // JS-render (akademi.bursa.com.tr) → canlı cheerio boş döner; veri Playwright
    // snapshot'ından gelir (scripts/scrape-courses-pw.mjs, key "BURSA").
    listUrl: "https://akademi.bursa.com.tr/egitimler",
    registerUrl: "https://akademi.bursa.com.tr/egitimler",
    selector: "h2",
  },
];

/**
 * İŞKUR — ülke geneli "yayındaki" mesleki eğitim kursları + İşbaşı Eğitim Programları (İEP).
 * Veri Playwright snapshot'ından gelir (KursOnAir.aspx ASP.NET/AjaxPro). Her kayıt KENDİ
 * İl/İlçesini taşır → lokasyona göre otomatik süzülür. Açık program yoksa boş döner.
 */
export const ISKUR_PROVIDER: CourseProvider = {
  key: "ISKUR",
  name: "İŞKUR — Kurs & İşbaşı Eğitim",
  city: "", // ulusal: kurs-başına şehir
  national: true,
  listUrl: "https://esube.iskur.gov.tr/Kurs/KursOnAir.aspx",
  registerUrl: "https://esube.iskur.gov.tr/Kurs/KursOnAir.aspx",
  selector: "",
};

const NOISE = /menü|menu|iletişim|iletisim|anasayfa|giriş|giris|kayıt ol|hakkında|duyuru|haber|tüm haklar|copyright|çerez|cookie|^ara$|^more$|devamı|detay|incele|^kurslar$|^branşlar$|^branslar$|^kategoriler$|^tümü$|galeri|birimler|yayın/i;

async function fetchProvider(p: CourseProvider): Promise<CourseItem[]> {
  try {
    const res = await fetch(p.listUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const $ = cheerio.load(await res.text());

    // Kart-bazlı (görselli) çekim. NOT: bazı sitelerde (KOMEK) görsel ve ad AYNI href'li
    // farklı anchor'larda → href'e göre eşleştir.
    if (p.cardSelector) {
      const raw = $(p.cardSelector)
        .toArray()
        .map((el) => {
          const card = $(el);
          const href = card.attr("href") ?? card.find("a").first().attr("href") ?? "";
          const name = card.find(p.nameInCard ?? p.selector).first().text().replace(/\s+/g, " ").trim();
          const imgEl = card.find("img").first();
          const img = imgEl.attr("data-src") ?? imgEl.attr("src") ?? "";
          return { href, name, img };
        });
      const imgByHref: Record<string, string> = {};
      for (const c of raw) if (c.img && c.href) imgByHref[c.href] = c.img;
      const items: CourseItem[] = [];
      for (const c of raw) {
        if (!c.name) continue;
        let img = c.img || imgByHref[c.href] || "";
        if (img && !/^https?:/.test(img)) {
          try {
            img = new URL(img, p.listUrl).toString();
          } catch {
            img = "";
          }
        }
        items.push({ name: c.name, image: img || undefined });
      }
      return items;
    }

    // Düz ad çekimi
    return $(p.selector)
      .map((_, el) => $(el).text())
      .get()
      .map((n) => ({ name: n.replace(/\s+/g, " ").trim() }));
  } catch {
    return [];
  }
}

/** Snapshot kaydını (string ya da obje) CourseItem'a çevir. */
function toItem(x: string | CourseItem): CourseItem {
  return typeof x === "string" ? { name: x } : x;
}

/** CourseItem listesini ad+merkez+saat'e göre tekilleştir + gürültü ele. */
function dedupeItems(items: CourseItem[]): CourseItem[] {
  const seen = new Set<string>();
  const out: CourseItem[] = [];
  for (const it of items) {
    const name = (it.name || "").replace(/\s+/g, " ").replace(/\(\s*\d+\s*\)\s*$/, "").trim();
    if (name.length < 2 || name.length > 60) continue;
    if (NOISE.test(name)) continue;
    const k = `${name.toLocaleLowerCase("tr")}|${(it.center ?? "").toLocaleLowerCase("tr")}|${it.schedule ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...it, name });
  }
  return out.slice(0, 200);
}

/** Tüm kurs sağlayıcılarından branşları çek (6 saat önbellekli, paralel, hataya dayanıklı). */
export const getCourseGroups = unstable_cache(
  async (): Promise<CourseGroup[]> => {
    const snap = (snapshot.data ?? {}) as Record<string, (string | CourseItem)[]>;
    const results = await Promise.all(
      COURSE_PROVIDERS.map(async (provider) => {
        const live = await fetchProvider(provider); // CourseItem[]
        const snapItems = (snap[provider.key] ?? []).map(toItem);
        // Canlı SSR + Playwright snapshot'ı birleştir.
        const merged = dedupeItems([...live, ...snapItems]);
        return { provider, courses: merged };
      }),
    );
    // İŞKUR (ulusal) — snapshot'tan; her kurs kendi İl/İlçesini taşır. center = "İlçe, İl"
    // hem görünüm hem benzersiz slug için. city alanı lokasyon filtresinde kullanılır.
    const iskurRaw = ((iskurSnapshot.data?.ISKUR ?? []) as CourseItem[]).map((c) => ({
      ...c,
      center: [c.district, c.city].filter(Boolean).join(", ") || c.center,
    }));
    if (iskurRaw.length > 0) {
      results.push({ provider: ISKUR_PROVIDER, courses: iskurRaw.slice(0, 300) });
    }
    return results;
  },
  ["course-groups-v9-iskur"],
  { revalidate: 21600 },
);

/** Kurs için kararlı slug (ad + merkez → aynı kursun farklı merkezleri ayrışır). */
export function courseSlug(providerKey: string, name: string, center?: string): string {
  return `kurs-${providerKey.toLowerCase()}-${slugify(name)}${center ? "-" + slugify(center) : ""}`;
}

export interface CourseDetail {
  slug: string;
  item: CourseItem;
  provider: CourseProvider;
}

/** Slug'dan kursu çöz (detay sayfası için). */
export async function getCourseBySlug(slug: string): Promise<CourseDetail | null> {
  const groups = await getCourseGroups();
  for (const g of groups) {
    for (const c of g.courses) {
      if (courseSlug(g.provider.key, c.name, c.center) === slug) {
        return { slug, item: c, provider: g.provider };
      }
    }
  }
  return null;
}
