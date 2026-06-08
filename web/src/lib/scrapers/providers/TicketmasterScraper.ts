import { TicketingScraper } from "../TicketingScraper";
import type { EventCategory, EventSource, ScrapedEvent } from "../../types";

/**
 * Ticketmaster Discovery API adapter — dünya geneli konser/tiyatro/spor/festival kaynağı.
 *
 * Tek JSON endpoint (Discovery v2). API anahtarı gerekir: TICKETMASTER_API_KEY env'i.
 * Anahtar yoksa sessizce boş döner (projedeki diğer opsiyonel entegrasyonlar gibi).
 *
 * Çekim seti: Türkiye derinlemesine (3 sayfa, size=100) + seçili dünya ülkeleri
 * (her biri 1 sayfa, size=50). Toplam ~11 istek; Discovery limiti 5000/gün.
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */
// NOT: setEventsForSource her event'i ardışık DB upsert ile yazar → tek run'da
// yazılan event sayısı serverless maxDuration(60sn) için bounded tutulmalı (~180).
const TR_PAGES = 2;
const TR_SIZE = 40;
const WORLD_COUNTRIES = ["US", "GB", "DE", "FR", "NL", "ES", "IT", "AE"];
const WORLD_SIZE = 12;

interface TmImage {
  url?: string;
  width?: number;
}

interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  images?: TmImage[];
  dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string } };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
  _embedded?: {
    venues?: Array<{ name?: string; city?: { name?: string } }>;
    attractions?: Array<{ name?: string }>;
  };
}

interface TmResponse {
  _embedded?: { events?: TmEvent[] };
}

function mapCategory(segment?: string, extra?: string): EventCategory {
  if (/festival/i.test(extra ?? "")) return "FESTIVAL";
  switch (segment) {
    case "Music":
      return "KONSER";
    case "Arts & Theatre":
      return "TIYATRO";
    case "Sports":
      return "SPOR";
    default:
      return "DIGER";
  }
}

function pickImage(images?: TmImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  const wide = images.find((img) => (img.width ?? 0) >= 640 && img.url);
  return (wide ?? images[0])?.url;
}

export class TicketmasterScraper extends TicketingScraper {
  public readonly source: EventSource = "TICKETMASTER";
  public readonly displayName = "Ticketmaster";
  public readonly baseUrl = "https://www.ticketmaster.com";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];
    const apiKey = process.env.TICKETMASTER_API_KEY?.trim();
    if (!apiKey) {
      console.warn("[TicketmasterScraper] TICKETMASTER_API_KEY yok — atlanıyor");
      return [];
    }

    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();

    const requests: Array<{ cc: string; size: number; page: number }> = [];
    for (let p = 0; p < TR_PAGES; p++) {
      requests.push({ cc: "TR", size: TR_SIZE, page: p });
    }
    for (const cc of WORLD_COUNTRIES) {
      requests.push({ cc, size: WORLD_SIZE, page: 0 });
    }

    // Tüm istekleri PARALEL çalıştır (ardışık olursa 11 istek 60sn maxDuration'ı aşıyordu).
    const lists = await Promise.all(
      requests.map(async (req) => {
        const url =
          `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(apiKey)}` +
          `&countryCode=${req.cc}&size=${req.size}&page=${req.page}&sort=date,asc`;
        try {
          const raw = await this.httpGet(url);
          const data = JSON.parse(raw) as TmResponse;
          return data._embedded?.events ?? [];
        } catch (err) {
          console.warn(
            `[TicketmasterScraper] ${req.cc} sayfa ${req.page} hatası:`,
            err instanceof Error ? err.message : err,
          );
          return [];
        }
      }),
    );

    for (const list of lists) {
        for (const ev of list) {
          const externalId = `ticketmaster-${ev.id}`;
          if (seen.has(externalId)) continue;
          seen.add(externalId);

          const title = (ev.name ?? "").trim();
          if (!title || title.toLowerCase() === "undefined") continue;

          const start = ev.dates?.start;
          let iso: string | null = null;
          if (start?.dateTime) {
            iso = start.dateTime;
          } else if (start?.localDate) {
            iso = `${start.localDate}${start.localTime ? "T" + start.localTime : ""}`;
          }
          if (!iso) continue;
          const startsAt = new Date(iso);
          if (Number.isNaN(startsAt.getTime())) continue;

          const venueObj = ev._embedded?.venues?.[0];
          const city = (venueObj?.city?.name ?? "").trim();
          if (!city) continue;
          const venue = (venueObj?.name ?? "").trim();

          const segment = ev.classifications?.[0]?.segment?.name;
          const genre = ev.classifications?.[0]?.genre?.name;
          const category = mapCategory(segment, `${title} ${genre ?? ""}`);

          const artist =
            segment === "Music" ? ev._embedded?.attractions?.[0]?.name?.trim() : undefined;

          all.push({
            source: this.source,
            externalId,
            title,
            category,
            venue,
            city,
            startsAt,
            isFree: false,
            imageUrl: pickImage(ev.images),
            ticketUrl: ev.url,
            artist,
          });
        }
    }

    return all;
  }
}
