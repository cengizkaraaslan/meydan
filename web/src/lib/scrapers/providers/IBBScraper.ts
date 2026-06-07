import * as cheerio from "cheerio";
import { MunicipalityScraper } from "../MunicipalityScraper";
import type { EventCategory, EventSource, ScrapedEvent } from "../../types";
import { MOCK_EVENTS } from "../../mock-data";

const TR_MONTH_MAP: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4, haziran: 5,
  temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

function parseTurkishDate(text: string): Date | null {
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;

  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, h = "20", min = "0"] = iso;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }
  const dm = cleaned.match(/(\d{1,2})\s+([a-zçğıöşü]+)(?:\s+(\d{4}))?(?:[^\d]*?(\d{1,2})[:.](\d{2}))?/);
  if (dm) {
    const [, day, monthWord, year, hour = "20", minute = "0"] = dm;
    const month = TR_MONTH_MAP[monthWord];
    if (month != null) {
      const y = Number(year ?? new Date().getFullYear());
      return new Date(y, month, Number(day), Number(hour), Number(minute));
    }
  }
  return null;
}

function guessCategory(text: string): EventCategory {
  const t = text.toLowerCase();
  if (/(konser|müzik|muzik|festival)/.test(t)) return "KONSER";
  if (/(tiyatro|oyun)/.test(t)) return "TIYATRO";
  if (/(stand[\s-]?up|komedi)/.test(t)) return "STANDUP";
  if (/(spor|maç|koşu|kosu|turnuva)/.test(t)) return "SPOR";
  if (/(sergi|expo|müze|muze)/.test(t)) return "SERGI";
  if (/(atölye|atolye|workshop|kurs)/.test(t)) return "ATOLYE";
  if (/(çocuk|cocuk|kids)/.test(t)) return "COCUK";
  if (/festival/.test(t)) return "FESTIVAL";
  return "DIGER";
}

const CARD_SELECTORS = [
  "article.event-card",
  ".event-card",
  ".etkinlik-card",
  ".event-item",
  ".etkinlik",
  "article.event",
  ".card.event",
  "[data-event]",
];

const TITLE_SELECTORS = [".event-title", ".etkinlik-title", "h2", "h3", "[itemprop='name']", ".title"];
const DATE_SELECTORS = ["[datetime]", "time", ".event-date", ".etkinlik-date", ".date", "[itemprop='startDate']"];
const VENUE_SELECTORS = [".event-venue", ".etkinlik-mekan", ".venue", ".location", "[itemprop='location']"];
const IMG_SELECTORS = ["img[src]", "img[data-src]", "[data-bg]"];

interface CardEl {
  find: (selector: string) => CardEl;
  first: () => CardEl;
  text: () => string;
  attr: (name: string) => string | undefined;
  each: (cb: (i: number, el: unknown) => void) => CardEl;
  length: number;
}

function pickText($el: CardEl, selectors: string[]): string {
  for (const sel of selectors) {
    const v = $el.find(sel).first().text().trim();
    if (v) return v.replace(/\s+/g, " ");
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

export class IBBScraper extends MunicipalityScraper {
  public readonly source: EventSource = "IBB";
  public readonly displayName = "İBB Kültür Sanat";
  public readonly baseUrl = "https://kultursanat.istanbul";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") {
      return this.mockFallback();
    }

    try {
      const html = await this.httpGet(`${this.baseUrl}/etkinliklerimiz`);
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
        console.warn("[IBBScraper] No event cards found — falling back to mock");
        return this.mockFallback();
      }

      const events: ScrapedEvent[] = [];
      cards.each((index, el) => {
        const card = $(el as never) as unknown as CardEl;
        const title = pickText(card, TITLE_SELECTORS);
        if (!title) return;

        const dateRaw = pickAttr(card, DATE_SELECTORS, ["datetime"]) || pickText(card, DATE_SELECTORS);
        const startsAt = parseTurkishDate(dateRaw) ?? new Date(Date.now() + 7 * 86400_000);

        const venue = pickText(card, VENUE_SELECTORS) || "İstanbul";
        const imageUrl = pickAttr(card, IMG_SELECTORS, ["data-src", "src", "data-bg"]);
        const href = card.find("a[href]").first().attr("href") ?? "";
        const externalId = `ibb-${(href || title).replace(/[^a-z0-9]/gi, "").slice(-12)}-${index}`;

        events.push({
          source: this.source,
          externalId,
          title,
          category: guessCategory(`${title} ${venue}`),
          venue,
          city: "İstanbul",
          startsAt,
          isFree: true,
          imageUrl: imageUrl ? new URL(imageUrl, this.baseUrl).toString() : undefined,
          ticketUrl: href ? new URL(href, this.baseUrl).toString() : undefined,
        });
      });

      if (events.length === 0) return this.mockFallback();
      return events;
    } catch (err) {
      console.warn("[IBBScraper] fetch failed, using mock:", err);
      return this.mockFallback();
    }
  }

  private mockFallback(): ScrapedEvent[] {
    return MOCK_EVENTS.filter((e) => e.source === this.source).map((e) => ({
      source: e.source, externalId: e.externalId, title: e.title, description: e.description,
      category: e.category, venue: e.venue, city: e.city, startsAt: e.startsAt,
      endsAt: e.endsAt, priceMin: e.priceMin, priceMax: e.priceMax, isFree: e.isFree,
      ticketUrl: e.ticketUrl, imageUrl: e.imageUrl, artist: e.artist,
    }));
  }
}
