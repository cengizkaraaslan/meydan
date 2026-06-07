import { TicketingScraper } from "../TicketingScraper";
import type { EventCategory, EventSource, ScrapedEvent } from "../../types";

/**
 * Songkick metro-area calendar API adapter — çok şehirli konser/festival kaynağı.
 *
 * Tek JSON endpoint, bakımı HTML scraping'e göre çok daha kolay (selector kırılması yok).
 * API anahtarı gerekir: SONGKICK_API_KEY env'i. Anahtar yoksa sessizce boş döner
 * (projedeki diğer opsiyonel entegrasyonlar gibi).
 *
 * Songkick metro ID'leri: İstanbul=32463, Ankara=32466, İzmir=32475.
 * Docs: https://www.songkick.com/developer
 */
const METROS: Array<{ id: number; city: string }> = [
  { id: 32463, city: "İstanbul" },
  { id: 32466, city: "Ankara" },
  { id: 32475, city: "İzmir" },
];

interface SkEvent {
  id: number;
  type?: string;
  displayName?: string;
  uri?: string;
  start?: { date?: string; time?: string | null; datetime?: string | null };
  location?: { city?: string | null };
  venue?: { displayName?: string | null };
  performance?: Array<{ displayName?: string; artist?: { displayName?: string } }>;
}

interface SkResponse {
  resultsPage?: { results?: { event?: SkEvent[] } };
}

function mapCategory(type?: string, name?: string): EventCategory {
  if (type === "Festival") return "FESTIVAL";
  if (/festival/i.test(name ?? "")) return "FESTIVAL";
  return "KONSER";
}

export class SongkickScraper extends TicketingScraper {
  public readonly source: EventSource = "SONGKICK";
  public readonly displayName = "Songkick";
  public readonly baseUrl = "https://www.songkick.com";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];
    const apiKey = process.env.SONGKICK_API_KEY?.trim();
    if (!apiKey) {
      console.warn("[SongkickScraper] SONGKICK_API_KEY yok — atlanıyor");
      return [];
    }

    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (const metro of METROS) {
      const url = `https://api.songkick.com/api/3.0/metro_areas/${metro.id}/calendar.json?apikey=${encodeURIComponent(apiKey)}&per_page=50`;
      try {
        const raw = await this.httpGet(url);
        const data = JSON.parse(raw) as SkResponse;
        const list = data.resultsPage?.results?.event ?? [];

        for (const ev of list) {
          const externalId = `songkick-${ev.id}`;
          if (seen.has(externalId)) continue;
          seen.add(externalId);

          const title = (ev.displayName ?? "").trim();
          if (!title) continue;

          const iso = ev.start?.datetime ?? (ev.start?.date ? `${ev.start.date}${ev.start.time ? "T" + ev.start.time : "T20:00:00"}` : null);
          if (!iso) continue;
          const startsAt = new Date(iso);
          if (Number.isNaN(startsAt.getTime())) continue;

          const artist =
            ev.performance?.[0]?.artist?.displayName ?? ev.performance?.[0]?.displayName ?? undefined;

          all.push({
            source: this.source,
            externalId,
            title,
            category: mapCategory(ev.type, title),
            venue: ev.venue?.displayName?.trim() || metro.city,
            city: ev.location?.city?.split(",")[0]?.trim() || metro.city,
            startsAt,
            isFree: false,
            artist,
            ticketUrl: ev.uri,
          });
        }
      } catch (err) {
        console.warn(`[SongkickScraper] metro ${metro.id} hatası:`, err instanceof Error ? err.message : err);
      }
    }

    return all;
  }
}
