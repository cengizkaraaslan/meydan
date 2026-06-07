import * as cheerio from "cheerio";
import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import type { EventCategory, EventSource, ScrapedEvent } from "../../types";

/**
 * festivall.com.tr scraper.
 *
 * Yapı:
 *   - Liste sayfası: https://festivall.com.tr/iller/{IL_ID}/{slug}/
 *   - Detay sayfası: https://festivall.com.tr/festival/{ID}/{slug}/
 *   - Her detayda JSON-LD `Event` şeması var → en güvenilir veri kaynağı.
 *
 * Strateji:
 *   1. Liste sayfasından kart linklerini topla (her ildeki etkinlik kartları)
 *   2. Her detayı paralel fetch et (concurrency=6)
 *   3. JSON-LD'den startsAt/endsAt/location/title oku
 *   4. JSON-LD yoksa HTML'den fallback parse et
 */

const BASE = "https://festivall.com.tr";

// Tüm 81 il — festivall.com.tr URL formatına göre il numarası → slug
const PROVINCE_URLS: Array<{ id: number; slug: string; name: string }> = [
  { id: 1,  slug: "adana", name: "Adana" },
  { id: 2,  slug: "adiyaman", name: "Adıyaman" },
  { id: 3,  slug: "afyonkarahisar", name: "Afyonkarahisar" },
  { id: 4,  slug: "agri", name: "Ağrı" },
  { id: 5,  slug: "amasya", name: "Amasya" },
  { id: 6,  slug: "ankara", name: "Ankara" },
  { id: 7,  slug: "antalya", name: "Antalya" },
  { id: 8,  slug: "artvin", name: "Artvin" },
  { id: 9,  slug: "aydin", name: "Aydın" },
  { id: 10, slug: "balikesir", name: "Balıkesir" },
  { id: 11, slug: "bilecik", name: "Bilecik" },
  { id: 12, slug: "bingol", name: "Bingöl" },
  { id: 13, slug: "bitlis", name: "Bitlis" },
  { id: 14, slug: "bolu", name: "Bolu" },
  { id: 15, slug: "burdur", name: "Burdur" },
  { id: 16, slug: "bursa", name: "Bursa" },
  { id: 17, slug: "canakkale", name: "Çanakkale" },
  { id: 18, slug: "cankiri", name: "Çankırı" },
  { id: 19, slug: "corum", name: "Çorum" },
  { id: 20, slug: "denizli", name: "Denizli" },
  { id: 21, slug: "diyarbakir", name: "Diyarbakır" },
  { id: 22, slug: "edirne", name: "Edirne" },
  { id: 23, slug: "elazig", name: "Elazığ" },
  { id: 24, slug: "erzincan", name: "Erzincan" },
  { id: 25, slug: "erzurum", name: "Erzurum" },
  { id: 26, slug: "eskisehir", name: "Eskişehir" },
  { id: 27, slug: "gaziantep", name: "Gaziantep" },
  { id: 28, slug: "giresun", name: "Giresun" },
  { id: 29, slug: "gumushane", name: "Gümüşhane" },
  { id: 30, slug: "hakkari", name: "Hakkari" },
  { id: 31, slug: "hatay", name: "Hatay" },
  { id: 32, slug: "isparta", name: "Isparta" },
  { id: 33, slug: "mersin", name: "Mersin" },
  { id: 34, slug: "istanbul", name: "İstanbul" },
  { id: 35, slug: "izmir", name: "İzmir" },
  { id: 36, slug: "kars", name: "Kars" },
  { id: 37, slug: "kastamonu", name: "Kastamonu" },
  { id: 38, slug: "kayseri", name: "Kayseri" },
  { id: 39, slug: "kirklareli", name: "Kırklareli" },
  { id: 40, slug: "kirsehir", name: "Kırşehir" },
  { id: 41, slug: "kocaeli", name: "Kocaeli" },
  { id: 42, slug: "konya", name: "Konya" },
  { id: 43, slug: "kutahya", name: "Kütahya" },
  { id: 44, slug: "malatya", name: "Malatya" },
  { id: 45, slug: "manisa", name: "Manisa" },
  { id: 46, slug: "kahramanmaras", name: "Kahramanmaraş" },
  { id: 47, slug: "mardin", name: "Mardin" },
  { id: 48, slug: "mugla", name: "Muğla" },
  { id: 49, slug: "mus", name: "Muş" },
  { id: 50, slug: "nevsehir", name: "Nevşehir" },
  { id: 51, slug: "nigde", name: "Niğde" },
  { id: 52, slug: "ordu", name: "Ordu" },
  { id: 53, slug: "rize", name: "Rize" },
  { id: 54, slug: "sakarya", name: "Sakarya" },
  { id: 55, slug: "samsun", name: "Samsun" },
  { id: 56, slug: "siirt", name: "Siirt" },
  { id: 57, slug: "sinop", name: "Sinop" },
  { id: 58, slug: "sivas", name: "Sivas" },
  { id: 59, slug: "tekirdag", name: "Tekirdağ" },
  { id: 60, slug: "tokat", name: "Tokat" },
  { id: 61, slug: "trabzon", name: "Trabzon" },
  { id: 62, slug: "tunceli", name: "Tunceli" },
  { id: 63, slug: "sanliurfa", name: "Şanlıurfa" },
  { id: 64, slug: "usak", name: "Uşak" },
  { id: 65, slug: "van", name: "Van" },
  { id: 66, slug: "yozgat", name: "Yozgat" },
  { id: 67, slug: "zonguldak", name: "Zonguldak" },
  { id: 68, slug: "aksaray", name: "Aksaray" },
  { id: 69, slug: "bayburt", name: "Bayburt" },
  { id: 70, slug: "karaman", name: "Karaman" },
  { id: 71, slug: "kirikkale", name: "Kırıkkale" },
  { id: 72, slug: "batman", name: "Batman" },
  { id: 73, slug: "sirnak", name: "Şırnak" },
  { id: 74, slug: "bartin", name: "Bartın" },
  { id: 75, slug: "ardahan", name: "Ardahan" },
  { id: 76, slug: "igdir", name: "Iğdır" },
  { id: 77, slug: "yalova", name: "Yalova" },
  { id: 78, slug: "karabuk", name: "Karabük" },
  { id: 79, slug: "kilis", name: "Kilis" },
  { id: 80, slug: "osmaniye", name: "Osmaniye" },
  { id: 81, slug: "duzce", name: "Düzce" },
];

const TR_MONTH: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4, haziran: 5,
  temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

/** "06.06.2026 - 07.06.2026" → { start, end } */
function parseDateRange(text: string): { startsAt?: Date; endsAt?: Date } {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(?:-\s*(\d{1,2})\.(\d{1,2})\.(\d{4}))?/);
  if (!m) return {};
  const start = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 9, 0));
  const end = m[4] ? new Date(Date.UTC(Number(m[6]), Number(m[5]) - 1, Number(m[4]), 21, 0)) : undefined;
  return { startsAt: start, endsAt: end };
}

interface JsonLdEvent {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  location?: {
    "@type"?: string;
    name?: string;
    address?: {
      addressLocality?: string;
      streetAddress?: string;
    };
  };
  organizer?: { name?: string };
  performer?: { name?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
}

interface JsonLdOffer {
  price?: string | number;
  lowPrice?: string | number;
  highPrice?: string | number;
  priceCurrency?: string;
}

/** JSON-LD offers'tan fiyat aralığı çıkar (festivall detay sayfalarında bulunur). */
function parseLdPrice(offers?: JsonLdOffer | JsonLdOffer[]): { min?: number; max?: number; free?: boolean } {
  if (!offers) return {};
  const list = Array.isArray(offers) ? offers : [offers];
  const nums: number[] = [];
  for (const o of list) {
    for (const v of [o?.price, o?.lowPrice, o?.highPrice]) {
      if (v == null) continue;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
      if (typeof n === "number" && !Number.isNaN(n)) nums.push(n);
    }
  }
  if (!nums.length) return {};
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === 0 && max === 0) return { free: true };
  return { min, max: max !== min ? max : undefined };
}

function extractJsonLd($: cheerio.CheerioAPI): JsonLdEvent | null {
  const scripts = $('script[type="application/ld+json"]');
  for (const el of scripts.toArray()) {
    const raw = $(el).text().trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const ev = item as JsonLdEvent;
        const type = Array.isArray(ev["@type"]) ? ev["@type"][0] : ev["@type"];
        if (type === "Event") return ev;
      }
    } catch {
      // bozuk JSON — bir sonraki scripte geç
    }
  }
  return null;
}

/** Festival başlığından kategori tahmini */
function guessCategory(title: string, description?: string): EventCategory {
  const t = (title + " " + (description ?? "")).toLowerCase();
  if (/müzik|muzik|rock|caz|jazz|konser/.test(t)) return "KONSER";
  if (/tiyatro|sahne/.test(t)) return "TIYATRO";
  if (/sergi|exhibition/.test(t)) return "SERGI";
  if (/spor|maraton|yarış|yaris|run/.test(t)) return "SPOR";
  if (/atölye|atolye|workshop/.test(t)) return "ATOLYE";
  if (/çocuk|cocuk|kids/.test(t)) return "COCUK";
  if (/stand|komedi/.test(t)) return "STANDUP";
  return "FESTIVAL";
}

interface CardLink {
  url: string;
  title: string;
  imageUrl?: string;
  cityHint: string;
  dateText: string;
}

/** Liste sayfası HTML'inden kart linklerini çıkar */
function parseListing(html: string, provinceName: string): CardLink[] {
  const $ = cheerio.load(html);
  const cards: CardLink[] = [];

  $(".he-180").each((_, el) => {
    const $el = $(el);
    const $a = $el.find("a.link").first();
    const url = $a.attr("href")?.trim();
    const title = ($a.attr("title") || $a.text() || "").trim().replace(/^\d+\.\s*/, "");
    if (!url || !title) return;

    const $img = $el.find("img").first();
    let imageUrl = ($img.attr("src") || "").trim();
    if (imageUrl && !imageUrl.startsWith("http")) {
      try {
        imageUrl = new URL(imageUrl, BASE).toString();
      } catch {
        imageUrl = "";
      }
    }
    if (/no-image\.png/i.test(imageUrl)) imageUrl = "";
    // Sadece gerçek bir görsel dosyasına işaret eden URL kabul edilir
    if (imageUrl && !/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(imageUrl)) {
      imageUrl = "";
    }

    const fullText = $el.text().replace(/\s+/g, " ").trim();
    const dateMatch = fullText.match(/(?:Tarih|Tahmini Tarih):?\s*([0-9.\s-]+)/i);
    const dateText = dateMatch?.[1].trim() ?? "";

    const venueMatch = fullText.match(/İstanbul|Ankara|İzmir|Bursa|Antalya|[A-ZÇĞİÖŞÜ][a-zçğıöşü]+/);
    void venueMatch;

    cards.push({
      url,
      title,
      imageUrl: imageUrl || undefined,
      cityHint: provinceName,
      dateText,
    });
  });

  return cards;
}

/** ID'yi `/festival/{id}/...` URL'inden çıkarır */
function extractFestivalId(url: string): string | null {
  const m = url.match(/\/festival\/(\d+)\//);
  return m?.[1] ?? null;
}

/** Concurrency-limited Promise.all */
async function pMap<T, R>(
  items: T[],
  fn: (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export class FestivallTrScraper extends BaseScraper {
  public readonly source: EventSource = "FESTIVALL_TR";
  public readonly displayName = "Festivall.com.tr — Türkiye Festivalleri";
  public readonly baseUrl = BASE;

  /** Test/dev için sadece bu illeri çek — boşsa hepsi */
  private readonly provinceFilter: string[] = [];
  /** Production'da 81 il çok ağır olur — günlük cron'da bir alt küme yeterli.
   * Boşsa hepsi çekilir. Env ile sınırlanabilir. */
  private readonly maxProvinces: number;
  private readonly detailConcurrency: number;
  private readonly skipDetails: boolean;

  constructor() {
    super();
    this.maxProvinces = Number(process.env.FESTIVALL_MAX_PROVINCES ?? 81);
    this.detailConcurrency = Number(process.env.FESTIVALL_DETAIL_CONCURRENCY ?? 6);
    // Detay sayfası fetch'i yavaş — sadece liste verisini kullan opsiyonu
    this.skipDetails = process.env.FESTIVALL_SKIP_DETAILS === "true";
  }

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    const provinces = (
      this.provinceFilter.length > 0
        ? PROVINCE_URLS.filter((p) => this.provinceFilter.includes(p.slug))
        : PROVINCE_URLS
    ).slice(0, this.maxProvinces);

    // 1. Her ildeki liste sayfasını çek (concurrency=4) → kart linkleri
    const allCards: CardLink[] = [];
    await pMap(
      provinces,
      async (p) => {
        try {
          const url = `${BASE}/iller/${p.id}/${p.slug}-festivalleri/`;
          const html = await this.httpGet(url, opts.abortSignal);
          const cards = parseListing(html, p.name);
          allCards.push(...cards);
        } catch (err) {
          console.warn(`[FestivallTr] ${p.name} liste fetch hatası:`, err instanceof Error ? err.message : err);
        }
      },
      4,
    );

    // 2. Aynı festival birden fazla şehirde gözükebilir — URL ile dedupe
    const uniqueCards = new Map<string, CardLink>();
    for (const c of allCards) {
      if (!uniqueCards.has(c.url)) uniqueCards.set(c.url, c);
    }
    const cards = [...uniqueCards.values()];

    // 3. Skip details → sadece liste verisinden event üret (hızlı, az veri)
    if (this.skipDetails) {
      return cards.map((c) => this.cardToEvent(c)).filter((e): e is ScrapedEvent => e !== null);
    }

    // 4. Detay sayfalarını paralel çek
    const events = await pMap(
      cards,
      async (card) => {
        try {
          const html = await this.httpGet(card.url, opts.abortSignal);
          return this.detailToEvent(card, html);
        } catch (err) {
          console.warn(`[FestivallTr] ${card.title} detay hatası:`, err instanceof Error ? err.message : err);
          return this.cardToEvent(card);
        }
      },
      this.detailConcurrency,
    );

    return events.filter((e): e is ScrapedEvent => e !== null);
  }

  /** Sadece liste verisinden event üret — detay yok */
  private cardToEvent(card: CardLink): ScrapedEvent | null {
    const id = extractFestivalId(card.url);
    if (!id) return null;
    const range = parseDateRange(card.dateText);
    if (!range.startsAt) return null;
    return {
      source: this.source,
      externalId: `festivall-${id}`,
      title: card.title,
      category: guessCategory(card.title),
      venue: card.cityHint,
      city: card.cityHint,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      isFree: false,
      ticketUrl: card.url,
      imageUrl: card.imageUrl,
    };
  }

  /** Detay HTML'inden event üret — JSON-LD öncelikli */
  private detailToEvent(card: CardLink, html: string): ScrapedEvent | null {
    const id = extractFestivalId(card.url);
    if (!id) return null;
    const $ = cheerio.load(html);

    const ld = extractJsonLd($);

    let title = card.title;
    let startsAt: Date | undefined;
    let endsAt: Date | undefined;
    let description: string | undefined;
    let imageUrl: string | undefined = card.imageUrl;
    let city = card.cityHint;
    let venue = card.cityHint;

    if (ld) {
      if (ld.name) title = ld.name.replace(/^\d+\.\s*/, "");
      if (ld.startDate) {
        const d = new Date(ld.startDate);
        if (!Number.isNaN(d.getTime())) startsAt = d;
      }
      if (ld.endDate) {
        const d = new Date(ld.endDate);
        if (!Number.isNaN(d.getTime())) endsAt = d;
      }
      if (ld.description) description = ld.description.trim();
      if (ld.image && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(ld.image)) {
        imageUrl = ld.image;
      }
      if (ld.location?.name) venue = ld.location.name;
      // NOT: city'yi JSON-LD'den ALMA — `Ankara Çankaya` gibi
      // ilçe ile birleşik gelebiliyor. Liste sayfasındaki cityHint
      // doğru il adıdır (PROVINCE_URLS'den).
    }

    // JSON-LD'de tarih yoksa list'den parse et
    if (!startsAt) {
      const range = parseDateRange(card.dateText);
      startsAt = range.startsAt;
      endsAt = range.endsAt;
    }

    // Hâlâ tarih yoksa atla
    if (!startsAt) return null;

    // HTML fallback: detay sayfasında <h1> başlığı
    if (!ld) {
      const h1 = $("h1").first().text().trim().replace(/^\d+\.\s*/, "");
      if (h1) title = h1;
      const h3Venue = $("h3").filter((_, el) => $(el).find(".fa-map-marker").length > 0).first().text().trim();
      if (h3Venue) venue = h3Venue.replace(/^\s*/, "");
    }

    // Detay sayfasındaki yapılandırılmış bilgileri (NEREDE / DÜZENLEYEN / ilçe)
    // çıkararak gerçek venue + organizer + district elde et.
    // Festivall.com.tr'nin .sss section'ı bu bilgileri tutar.
    const structured = extractStructuredInfo($);
    if (structured.venue && structured.venue.length > 3) {
      venue = structured.venue;
    }

    // DETAYLAR bölümünden uzun açıklama paragrafını + PROGRAM bilgisini çek.
    // Bu Festivall.com.tr'nin gerçek "festival hakkında" metnidir.
    const detayText = extractDetaylarText($);
    const programText = extractProgramText($);

    // Eğer JSON-LD'den gelen description placeholder/zayıfsa
    // (örn. "Title City Ilce" tarzı, < 60 karakter ve title'ı tekrar ediyor),
    // veya hiç yoksa, gerçek DETAYLAR varsa onu kullan, yoksa structured info'dan üret.
    const isWeak =
      !description ||
      description.length < 60 ||
      description.toLowerCase().includes(title.toLowerCase()) &&
        description.length < title.length + 40;
    if (isWeak) {
      if (detayText && detayText.length > 30) {
        description = detayText;
      } else {
        description = buildDescription({
          title,
          city,
          district: structured.district,
          venue: structured.venue,
          organizer: structured.organizer,
          startsAt,
          endsAt,
        });
      }
    }

    // PROGRAM bilgisi varsa description'a ekle (kısa özet)
    if (programText && description && !description.includes("PROGRAM")) {
      description = `${description}\n\nPROGRAM:\n${programText}`;
    }

    const price = parseLdPrice(ld?.offers);

    return {
      source: this.source,
      externalId: `festivall-${id}`,
      title,
      description,
      category: guessCategory(title, description),
      venue: venue || city,
      city,
      district: structured.district,
      startsAt,
      endsAt,
      isFree: price.free ?? false,
      priceMin: price.min,
      priceMax: price.max,
      ticketUrl: card.url,
      imageUrl,
    };
  }
}

interface StructuredInfo {
  district?: string;
  venue?: string;
  organizer?: string;
}

/**
 * "DETAYLAR" başlığı altındaki uzun açıklama paragrafını çek.
 * HTML: <h4>DETAYLAR</h4><a>kategori</a> > <a>alt-kategori</a><hr>
 *       Festival hakkında uzun metin...
 */
function extractDetaylarText($: cheerio.CheerioAPI): string | null {
  let result: string | null = null;
  $("h4").each((_, el) => {
    const $h = $(el);
    const heading = $h.text().trim().toUpperCase();
    if (!heading.includes("DETAYLAR")) return;

    const $parent = $h.parent();
    // <hr>'den SONRAKİ tüm metni topla
    const html = $parent.html() ?? "";
    const afterHr = html.split(/<hr\s*\/?>/i).slice(1).join("<hr>");
    if (!afterHr) return;

    // HTML'i text'e çevir
    const $tmp = cheerio.load(`<div>${afterHr}</div>`);
    const text = $tmp("div")
      .text()
      .replace(/\s+/g, " ")
      .replace(/´/g, "'")
      .trim();
    if (text.length > 20) {
      // En fazla 1000 karakter
      result = text.slice(0, 1000);
    }
  });
  return result;
}

/**
 * "Programda neler var?" başlığı altındaki konser takvimini çek.
 * HTML: <h5>Programda neler var?</h5><p class="word">Konser Takvimi\n5 Haziran Cuma:\n...</p>
 */
function extractProgramText($: cheerio.CheerioAPI): string | null {
  let result: string | null = null;
  $("h5").each((_, el) => {
    const $h = $(el);
    const heading = $h.text().trim().toLocaleLowerCase("tr");
    if (!heading.includes("program")) return;

    // h5 sonrası bir veya birden çok <p>
    let $next = $h.next();
    let collected = "";
    while ($next.length > 0 && $next.is("p")) {
      collected += $next.text() + "\n";
      $next = $next.next();
    }
    const text = collected
      .replace(/Eskişehir.*?programında neler var\?/gi, "")
      .replace(/.*?programında neler var\?/gi, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();
    if (text.length > 20) {
      result = text.slice(0, 800);
    }
  });
  return result;
}

/** Festivall.com.tr detay sayfasının .sss bölümünden bilgileri çıkar */
function extractStructuredInfo($: cheerio.CheerioAPI): StructuredInfo {
  const info: StructuredInfo = {};

  // .sss section içindeki h4 başlıklarından sonraki text'ler
  // <h4>NEREDE?</h4> ... <span>Kentpark Yeni Festival Alanı</span>
  $("section.sss h4").each((_, el) => {
    const $h = $(el);
    const heading = $h.text().trim().toUpperCase().replace(/\s+/g, " ").replace("?", "");
    const $parent = $h.parent();

    if (heading.includes("NEREDE")) {
      // İlçe link'i: ilceler/.../*-festival/ slug'ından gelir.
      // href bazen "ilceler/..." (relative) bazen "/ilceler/..." olabiliyor.
      const $districtLink = $parent.find('a[href*="ilceler/"]').first();
      const districtText = $districtLink.text().trim();
      if (districtText && districtText.length > 1 && districtText.length < 60) {
        info.district = districtText;
      }

      // Venue: <span> tag'i fa-map-marker'dan sonra gelir
      const spanText = $parent.find("span").first().text().trim();
      if (spanText && spanText.length > 2 && spanText.length < 120) {
        info.venue = spanText;
      }
    } else if (heading.includes("DÜZENLEYEN")) {
      // <a href="...">Eskişehir Kahve Festivali </a> tarafından düzenleniyor
      const $orgLink = $parent.find("a").first();
      const orgText = $orgLink.text().trim();
      if (orgText && orgText.length > 2 && orgText.length < 120) {
        info.organizer = orgText;
      }
    }
  });

  return info;
}

/** Yapılandırılmış info'dan okunabilir Türkçe açıklama metni oluştur */
function buildDescription(p: {
  title: string;
  city: string;
  district?: string;
  venue?: string;
  organizer?: string;
  startsAt: Date;
  endsAt?: Date;
}): string {
  const parts: string[] = [];

  // Tarih cümlesi
  const startStr = formatTrDate(p.startsAt);
  const endStr = p.endsAt ? formatTrDate(p.endsAt) : null;
  const dateLine =
    endStr && endStr !== startStr
      ? `${p.title}, ${startStr} – ${endStr} tarihleri arasında düzenleniyor.`
      : `${p.title}, ${startStr} tarihinde düzenleniyor.`;
  parts.push(dateLine);

  // Konum cümlesi
  const locationBits: string[] = [];
  if (p.venue) locationBits.push(p.venue);
  if (p.district && p.district !== p.city) locationBits.push(p.district);
  locationBits.push(p.city);
  if (locationBits.length > 0) {
    parts.push(`Konum: ${locationBits.join(", ")}.`);
  }

  // Organizatör
  if (p.organizer && p.organizer.toLowerCase() !== p.title.toLowerCase()) {
    parts.push(`Düzenleyen: ${p.organizer}.`);
  }

  return parts.join(" ");
}

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatTrDate(d: Date): string {
  return `${d.getUTCDate()} ${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
