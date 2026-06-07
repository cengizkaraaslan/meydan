import { UniversityScraper } from "../UniversityScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { MOCK_EVENTS } from "../../mock-data";

export class BogaziciScraper extends UniversityScraper {
  public readonly source: EventSource = "BOGAZICI";
  public readonly displayName = "Boğaziçi Üniversitesi";
  public readonly baseUrl = "https://www.boun.edu.tr";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") {
      return this.mockFallback();
    }

    try {
      // Boğaziçi etkinlik sayfası şu an parse edilmiyor; mock fallback aktif.
      // const html = await this.httpGet(`${this.baseUrl}/tr_TR/Content/Etkinlikler`);
      // const $ = cheerio.load(html);
      return this.mockFallback();
    } catch (err) {
      console.warn("[BogaziciScraper] fetch failed, using mock:", err);
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
