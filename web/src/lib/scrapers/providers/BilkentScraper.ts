import { UniversityScraper } from "../UniversityScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { MOCK_EVENTS } from "../../mock-data";

export class BilkentScraper extends UniversityScraper {
  public readonly source: EventSource = "BILKENT";
  public readonly displayName = "Bilkent Üniversitesi";
  public readonly baseUrl = "https://w3.bilkent.edu.tr";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") {
      return this.mockFallback();
    }

    try {
      // Bilkent etkinlik listesi şu an parse edilmiyor; mock fallback aktif.
      // const html = await this.httpGet(`${this.baseUrl}/bilkent/events/`);
      // const $ = cheerio.load(html);
      return this.mockFallback();
    } catch (err) {
      console.warn("[BilkentScraper] fetch failed, using mock:", err);
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
