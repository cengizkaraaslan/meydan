import * as cheerio from "cheerio";
import { BaseScraper } from "../BaseScraper";
import type { EventSource, ScrapedEvent } from "../../types";

const TR_MONTH: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4, haziran: 5,
  temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

function parseFestTrDate(text: string): { startsAt: Date; endsAt?: Date } | null {
  const cleaned = text.toLowerCase();
  const pattern = /(\d{1,2})\s+([a-zçğıöşü]+)(?:\s*•?\s*(\d{1,2}):(\d{2}))?/g;
  const matches = [...cleaned.matchAll(pattern)];
  if (matches.length === 0) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const oneDayMs = 86400_000;

  const dates = matches
    .map((m) => {
      const day = Number(m[1]);
      const month = TR_MONTH[m[2]];
      if (month == null) return null;
      const hour = m[3] ? Number(m[3]) : 12;
      const minute = m[4] ? Number(m[4]) : 0;
      let d = new Date(currentYear, month, day, hour, minute);
      if (d.getTime() < now.getTime() - oneDayMs) {
        d = new Date(currentYear + 1, month, day, hour, minute);
      }
      return d;
    })
    .filter((d): d is Date => d !== null);

  if (dates.length === 0) return null;
  return { startsAt: dates[0], endsAt: dates[1] };
}

/** İlçe slug → il eşlemesi. Festtr'da bir festival genelde ilçe slug'ı taşır;
 *  burada il'e çevirip filtreler düzgün çalışsın. Eksik olan ilçeler aynı kalır. */
const DISTRICT_TO_PROVINCE: Record<string, string> = {
  // İstanbul ilçeleri
  kadikoy: "İstanbul", besiktas: "İstanbul", uskudar: "İstanbul", sisli: "İstanbul",
  beyoglu: "İstanbul", fatih: "İstanbul", bakirkoy: "İstanbul", maltepe: "İstanbul",
  pendik: "İstanbul", kartal: "İstanbul", sariyer: "İstanbul", besikdusu: "İstanbul",
  // Ankara
  cankaya: "Ankara", kecioren: "Ankara", yenimahalle: "Ankara", etimesgut: "Ankara",
  // İzmir
  konak: "İzmir", karsiyaka: "İzmir", bornova: "İzmir", buca: "İzmir", cesme: "İzmir",
  alacati: "İzmir", urla: "İzmir", foca: "İzmir",
  // Eskişehir
  mihaliccik: "Eskişehir", tepebasi: "Eskişehir", odunpazari: "Eskişehir",
  sivrihisar: "Eskişehir", seyitgazi: "Eskişehir", inonu: "Eskişehir",
  // Bursa
  mudanya: "Bursa", tirilye: "Bursa", iznik: "Bursa", gemlik: "Bursa",
  osmangazi: "Bursa", nilufer: "Bursa", yildirim: "Bursa",
  // Antalya
  konyaalti: "Antalya", muratpasa: "Antalya", alanya: "Antalya", manavgat: "Antalya",
  kemer: "Antalya", kas: "Antalya", side: "Antalya",
  // Aydın
  kusadasi: "Aydın", didim: "Aydın",
  // Muğla
  bodrum: "Muğla", marmaris: "Muğla", fethiye: "Muğla", datca: "Muğla", milas: "Muğla",
  gocek: "Muğla",
  // Çanakkale
  ayvacik: "Çanakkale", bozcaada: "Çanakkale", gokceada: "Çanakkale",
  // Samsun
  bafra: "Samsun", carsamba: "Samsun", terme: "Samsun",
  // Manisa
  alasehir: "Manisa", sarigol: "Manisa", soma: "Manisa",
  // Sakarya
  adapazari: "Sakarya", karasu: "Sakarya",
  // Kocaeli
  izmit: "Kocaeli", gebze: "Kocaeli",
  // Tekirdağ
  corlu: "Tekirdağ", suleymanpasa: "Tekirdağ",
  // Trabzon
  akcaabat: "Trabzon", arsin: "Trabzon",
  // Diğer popüler
  cappadocia: "Nevşehir", kapadokya: "Nevşehir", goreme: "Nevşehir",
  pamukkale: "Denizli", harran: "Şanlıurfa",
};

function normalizeCity(rawCity: string, cardText: string): string {
  const slug = rawCity.toLowerCase().replace(/[^a-z]/g, "");
  if (DISTRICT_TO_PROVINCE[slug]) return DISTRICT_TO_PROVINCE[slug];
  // Eğer kart text'inde tanıdık bir il varsa onu kullan
  const provinces = ["İstanbul","Ankara","İzmir","Eskişehir","Bursa","Antalya","Samsun","Manisa","Aydın","Muğla","Konya","Adana","Mersin","Trabzon","Kayseri","Gaziantep","Denizli","Şanlıurfa","Tekirdağ","Sakarya","Kocaeli","Balıkesir","Çanakkale","Nevşehir"];
  for (const p of provinces) {
    if (cardText.includes(p)) return p;
  }
  return rawCity.charAt(0).toUpperCase() + rawCity.slice(1);
}

const CARD_SELECTORS = [
  "article.type-tribe_events",
  ".tribe-events-calendar-list__event",
  ".tribe-events-loop .type-tribe_events",
  ".festival-item",
  "article.tribe_events",
];

const TITLE_SELECTORS = [
  ".tribe-events-calendar-list__event-title a",
  ".tribe-events-list-event-title a",
  "h3 a",
  "h2 a",
  ".entry-title a",
];

const DATE_SELECTORS = [
  ".tribe-events-calendar-list__event-datetime",
  ".tribe-event-date-start",
  "time",
  ".tribe-event-schedule-details",
  ".event-date",
];

const VENUE_SELECTORS = [
  ".tribe-events-calendar-list__event-venue",
  ".tribe-events-venue-details",
  ".event-location a",
  ".venue a",
];

const IMG_SELECTORS = [".tribe-events-calendar-list__event-featured-image img", "img.wp-post-image", "img[src]"];

const DESCRIPTION_SELECTORS = [
  ".tribe-events-list-event-description",
  ".tribe-events-calendar-list__event-description",
  ".tribe-events-content",
  ".entry-content p",
  ".event-description",
  "p",
];

interface CardEl {
  find: (s: string) => CardEl;
  first: () => CardEl;
  text: () => string;
  attr: (n: string) => string | undefined;
  each: (cb: (i: number, el: unknown) => void) => CardEl;
  length: number;
}

function pickText($el: CardEl, selectors: string[]): string {
  for (const sel of selectors) {
    const t = $el.find(sel).first().text().trim().replace(/\s+/g, " ");
    if (t) return t;
  }
  return "";
}

function pickAttr($el: CardEl, selectors: string[], attrs: string[]): string {
  for (const sel of selectors) {
    const node = $el.find(sel).first();
    for (const attr of attrs) {
      const v = node.attr(attr);
      if (v) return v.trim();
    }
  }
  return "";
}

export class FestTrScraper extends BaseScraper {
  public readonly source: EventSource = "FESTTR";
  public readonly displayName = "FestTR — Kültür Festivalleri";
  public readonly baseUrl = "https://festtr.com";
  private readonly listingUrl = "https://festtr.com/kultur-festivalleri/";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    try {
      const html = await this.httpGet(this.listingUrl);
      const $ = cheerio.load(html);

      let cards = $() as unknown as CardEl;
      for (const sel of CARD_SELECTORS) {
        const found = $(sel) as unknown as CardEl;
        if (found.length > 0) {
          cards = found;
          break;
        }
      }
      if (cards.length === 0) {
        console.warn("[FestTrScraper] Hiç kart bulunamadı");
        return [];
      }

      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();

      cards.each((index, el) => {
        const card = $(el as never) as unknown as CardEl;
        const title = pickText(card, TITLE_SELECTORS);
        if (!title || title.length < 3) return;

        const href = pickAttr(card, TITLE_SELECTORS, ["href"]) || card.find("a[href]").first().attr("href") || "";
        const externalId = `festtr-${href.replace(/[^a-z0-9]/gi, "").slice(-14) || index}`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        const dateAttr = card.find("[datetime]").first().attr("datetime") ?? "";
        const dateText = dateAttr || pickText(card, DATE_SELECTORS) || card.text();
        const parsed = parseFestTrDate(dateText);
        const startsAt = parsed?.startsAt ?? new Date(Date.now() + 14 * 86400_000);
        const endsAt = parsed?.endsAt;

        let rawCity = pickText(card, VENUE_SELECTORS);
        if (!rawCity) {
          // City link örneği: /mekan/istanbul/ veya /mekan/mihaliccik/
          const cityHref = card.find('a[href*="/mekan/"]').first().attr("href") ?? "";
          const m = cityHref.match(/\/mekan\/([^/]+)/);
          if (m) rawCity = m[1];
        }
        if (!rawCity) rawCity = "Türkiye";
        const city = normalizeCity(rawCity, card.text());

        let imageUrl = pickAttr(card, IMG_SELECTORS, ["data-src", "src", "data-lazy-src"]);
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = new URL(imageUrl, this.baseUrl).toString();
        }

        let description: string | undefined;
        const descRaw = pickText(card, DESCRIPTION_SELECTORS);
        if (descRaw && descRaw !== title && descRaw.length >= 20) {
          description = descRaw.slice(0, 300);
        }

        events.push({
          source: this.source,
          externalId,
          title,
          description,
          category: "FESTIVAL",
          venue: city,
          city,
          startsAt,
          endsAt,
          isFree: false,
          imageUrl: imageUrl || undefined,
          ticketUrl: href ? new URL(href, this.baseUrl).toString() : undefined,
        });
      });

      return events;
    } catch (err) {
      console.warn("[FestTrScraper] fetch hatası:", err instanceof Error ? err.message : err);
      return [];
    }
  }
}
