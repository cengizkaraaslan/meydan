import * as cheerio from "cheerio";
import { MunicipalityScraper } from "./MunicipalityScraper";
import { isAdminNotice, isEventTitle, guessCategory } from "./parse-helpers";
import type { EventSource, ScrapedEvent } from "../types";

export interface MunicipalityConfig {
  source: EventSource;
  displayName: string;
  baseUrl: string;
  /** Etkinlik listeleme sayfasının path'i (baseUrl'e relative veya full) */
  eventListPath: string;
  city: string;
  /** Opsiyonel HTTP header override (örn. bot UA'sını 403'leyen siteler için tarayıcı User-Agent). */
  headers?: Record<string, string>;
  /** Eksik sertifika zincirli (.edu.tr/.gov.tr'de yaygın) siteler için TLS doğrulamasını gevşet. */
  insecureTLS?: boolean;
  /** Opsiyonel CSS selector overrides (sitenin yapısına göre) */
  selectors?: {
    card?: string;
    title?: string;
    date?: string;
    venue?: string;
    image?: string;
    link?: string;
    description?: string;
  };
  /** JSON API kaynağı (varsa HTML scraping yerine bu kullanılır). */
  api?: {
    url: string;                 // tam URL ya da baseUrl'e relative
    listPath?: string;           // yanıt sarmalıysa "data" / "data.events" nokta-yollu; dizi ise boş bırak
    fields: {
      title: string;
      date: string;
      url?: string;
      image?: string;
      id?: string;
      venue?: string;
      description?: string;
    };
  };
}

const DEFAULT_SELECTORS = {
  card: ".event-card, .etkinlik-card, article.event, .event-item, .etkinlik, .card.event, [data-event]",
  title: ".event-title, .etkinlik-title, h3, h2, h4, [itemprop='name'], .title, .baslik",
  date: "[datetime], time, .event-date, .etkinlik-date, .date, .tarih, [itemprop='startDate']",
  venue: ".event-venue, .etkinlik-mekan, .venue, .location, .yer, .mekan, [itemprop='location']",
  image: "img[src], img[data-src], [data-bg]",
  link: "a[href]",
  description: ".event-description, .etkinlik-aciklama, .description, .aciklama, .excerpt, .summary, [itemprop='description'], p.lead, p.subtitle, p",
};

const TR_MONTH: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4, haziran: 5,
  temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

function parseDate(text: string): Date | null {
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;

  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, h = "20", min = "0"] = iso;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }
  const dmy = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[^\d]*(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const [, d, m, y, h = "20", min = "0"] = dmy;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }
  const tr = cleaned.match(/(\d{1,2})\s*([a-zçğıöşü]+)\s*(\d{4})?(?:[^\d]*(\d{1,2})[:.](\d{2}))?/);
  if (tr) {
    const [, day, monthWord, year, hour = "20", minute = "0"] = tr;
    const month = TR_MONTH[monthWord];
    if (month != null) {
      return new Date(Number(year ?? new Date().getFullYear()), month, Number(day), Number(hour), Number(minute));
    }
  }
  return null;
}

/**
 * Tarih aralığı metnini başlangıç+bitiş'e ayırır ("12 - 15 Haziran 2026",
 * "12.06.2026 - 15.06.2026", "12 Haziran - 15 Haziran 2026", "2026-06-12 - 2026-06-15").
 * Ayıraç çevresinde BOŞLUK arar (ASCII "-" için) ki ISO/dd.mm tarihindeki tireler
 * bölünmesin. Aralık yoksa/çözülemezse end=null döner. "12 - 15 Haziran 2026" gibi ilk
 * parçanın yalnız gün olduğu durumda ay/yıl bilgisini son parçadan ödünç alır.
 */
function parseDateRange(text: string): { start: Date | null; end: Date | null } {
  const raw = text.trim();
  if (!raw) return { start: null, end: null };
  const parts = raw
    .split(/\s+[-–—]\s+|\s*[–—→]\s*|\s+(?:ile|ila)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return { start: parseDate(raw), end: null };

  const first = parts[0];
  const last = parts[parts.length - 1];
  let start = parseDate(first);
  const end = parseDate(last);
  // "12 - 15 Haziran 2026": ilk parça sadece gün → ay/yıl/saat son parçadan al.
  if (!start && /^\d{1,2}$/.test(first) && end) {
    start = new Date(end);
    start.setDate(Number(first));
  }
  return {
    start: start ?? end,
    // Bitiş ancak gerçek bir aralıksa (başlangıçtan SONRA) anlamlı.
    end: start && end && end.getTime() > start.getTime() ? end : null,
  };
}

interface AnyCheerio {
  find: (s: string) => AnyCheerio;
  first: () => AnyCheerio;
  text: () => string;
  attr: (n: string) => string | undefined;
  each: (cb: (i: number, el: unknown) => void) => AnyCheerio;
  is: (s: string) => boolean;
  length: number;
}

export class GenericMunicipalityScraper extends MunicipalityScraper {
  public readonly source: EventSource;
  public readonly displayName: string;
  public readonly baseUrl: string;
  public readonly city: string;
  private readonly listingUrl: string;
  private readonly selectors: Required<NonNullable<MunicipalityConfig["selectors"]>>;
  /** true → başlık net etkinlik (allowlist) değilse ele; false → sadece idari duyuruyu (denylist) ele. */
  protected readonly requireEventSignal: boolean = false;

  constructor(private readonly config: MunicipalityConfig) {
    super();
    this.source = config.source;
    this.displayName = config.displayName;
    this.baseUrl = config.baseUrl;
    this.city = config.city;
    this.listingUrl = config.eventListPath.startsWith("http")
      ? config.eventListPath
      : new URL(config.eventListPath, config.baseUrl).toString();
    this.selectors = { ...DEFAULT_SELECTORS, ...config.selectors };
  }

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    if (this.config.api) return this.fetchFromApi(this.config.api);

    try {
      const html = await this.httpGet(this.listingUrl, undefined, {
        headers: this.config.headers,
        insecureTLS: this.config.insecureTLS,
      });
      const $ = cheerio.load(html);

      const cards = $(this.selectors.card) as unknown as AnyCheerio;
      if (cards.length === 0) {
        return [];
      }

      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();

      cards.each((index, el) => {
        const card = $(el as never) as unknown as AnyCheerio;
        let title = card.find(this.selectors.title).first().text().trim().replace(/\s+/g, " ");
        // Fallback: başlık çocuk elemanda yoksa (başlıksız/anchor-temelli kartlar),
        // kartın kendi <a> metnine ya da kart metnine düş.
        if (!title) {
          const alt = (card.is("a") ? card : card.find("a").first()) as unknown as AnyCheerio;
          title = alt.text().trim().replace(/\s+/g, " ");
        }
        title = title.slice(0, 160);
        if (!title || title.length < 4) return;
        // Duyuru-board kaynakları (üniv): sadece net etkinlik başlıklarını tut.
        // Etkinlik-listesi kaynakları (belediye): yalnız idari duyuruları (kesinti/ihale/sınav/alım) ele.
        if (this.requireEventSignal ? !isEventTitle(title) : isAdminNotice(title)) return;

        // Link: çocuk <a> yoksa kartın kendisi <a> olabilir.
        const linkEl = card.find(this.selectors.link).first();
        const href = linkEl.attr("href") ?? (card.is("a") ? card.attr("href") ?? "" : "");
        const externalId = `${this.config.source.toLowerCase()}-${
          href.replace(/[^a-z0-9]/gi, "").slice(-12) || index
        }`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        const dateRaw =
          card.find(this.selectors.date).first().attr("datetime") ??
          card.find(this.selectors.date).first().text();
        const range = parseDateRange(dateRaw);
        const startsAt = range.start ?? new Date(Date.now() + 7 * 86400_000);
        const endsAt = range.end ?? undefined;

        const venue = card.find(this.selectors.venue).first().text().trim() || this.config.displayName;
        const descRaw = card.find(this.selectors.description).first().text().trim().replace(/\s+/g, " ");
        // Title'la birebir aynıysa ya da çok kısaysa açıklama sayma — gürültü olur.
        const description =
          descRaw && descRaw !== title && descRaw.length >= 20
            ? descRaw.slice(0, 400)
            : undefined;
        let imageUrl = card.find(this.selectors.image).first().attr("data-src")
          ?? card.find(this.selectors.image).first().attr("src")
          ?? "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = new URL(imageUrl, this.baseUrl).toString();
        }

        events.push({
          source: this.config.source,
          externalId,
          description,
          title,
          category: guessCategory(`${title} ${venue}`),
          venue,
          city: this.config.city,
          startsAt,
          endsAt,
          isFree: true,
          imageUrl: imageUrl || undefined,
          ticketUrl: href ? new URL(href, this.baseUrl).toString() : undefined,
        });
      });

      // Kaynak başına üst sınır: bazı üniv/belediye siteleri TÜM duyuru arşivini (binlerce)
      // döküyor (PAU/GOP/KTÜ gibi). Listeyi gürültüye boğmasın diye ilk 60 ile sınırla.
      return events.slice(0, 60);
    } catch (err) {
      console.warn(`[${this.config.source}] fetch hatası:`, err instanceof Error ? err.message : err);
      return [];
    }
  }

  private async fetchFromApi(
    api: NonNullable<MunicipalityConfig["api"]>,
  ): Promise<ScrapedEvent[]> {
    try {
      const apiUrl = api.url.startsWith("http")
        ? api.url
        : new URL(api.url, this.baseUrl).toString();
      const raw = await this.httpGet(apiUrl, undefined, {
        headers: this.config.headers,
        insecureTLS: this.config.insecureTLS,
      });
      const json: unknown = JSON.parse(raw);
      const list = (api.listPath
        ? api.listPath.split(".").reduce<any>((acc, k) => acc?.[k], json)
        : json) as Record<string, unknown>[] | undefined;
      if (!Array.isArray(list)) return [];

      const f = api.fields;
      const toAbs = (v?: string) =>
        v ? (v.startsWith("http") ? v : new URL(v, this.baseUrl).toString()) : undefined;

      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < list.length; i++) {
        const row = list[i];
        const title = String(row[f.title] ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
        if (!title || title.length < 4) continue;
        if (this.requireEventSignal ? !isEventTitle(title) : isAdminNotice(title)) continue;
        const href = f.url ? String(row[f.url] ?? "") : "";
        const idRaw = f.id ? String(row[f.id] ?? "") : "";
        const externalId = `${this.config.source.toLowerCase()}-${
          (idRaw || href).replace(/[^a-z0-9]/gi, "").slice(-12) || i
        }`;
        if (seen.has(externalId)) continue;
        seen.add(externalId);
        const range = parseDateRange(String(row[f.date] ?? ""));
        const startsAt = range.start ?? new Date(Date.now() + 7 * 86400_000);
        const endsAt = range.end ?? undefined;
        const venue = (f.venue ? String(row[f.venue] ?? "") : "").trim() || this.config.displayName;
        const descRaw = (f.description ? String(row[f.description] ?? "") : "").trim().replace(/\s+/g, " ");
        const description =
          descRaw && descRaw !== title && descRaw.length >= 20 ? descRaw.slice(0, 400) : undefined;
        events.push({
          source: this.config.source,
          externalId,
          title,
          description,
          category: guessCategory(`${title} ${venue}`),
          venue,
          city: this.config.city,
          startsAt,
          endsAt,
          isFree: true,
          imageUrl: toAbs(f.image ? String(row[f.image] ?? "") : undefined),
          ticketUrl: toAbs(href),
        });
      }
      return events.slice(0, 60);
    } catch (err) {
      console.warn(`[${this.config.source}] api fetch hatası:`, err instanceof Error ? err.message : err);
      return [];
    }
  }
}

export class GenericUniversityScraper extends GenericMunicipalityScraper {
  // Üniversite "duyurular" sayfaları idari ilanla dolu → yalnız net etkinlik başlıklarını tut.
  protected override readonly requireEventSignal = true;
}
