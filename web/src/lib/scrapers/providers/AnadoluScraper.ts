import { UniversityScraper } from "../UniversityScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { MOCK_EVENTS } from "../../mock-data";

export class AnadoluScraper extends UniversityScraper {
  public readonly source: EventSource = "ANADOLU_UNI";
  public readonly displayName = "Anadolu Üniversitesi";
  public readonly baseUrl = "https://www.anadolu.edu.tr";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") {
      return this.mockFallback();
    }

    try {
      // Anadolu Üniversitesi etkinlik sayfası şu an statik bir liste sunmuyor;
      // gerçek HTML parse'ı geldiğinde mock fallback bırakılacak.
      // const html = await this.httpGet(`${this.baseUrl}/tr/etkinlikler`);
      // const $ = cheerio.load(html);
      return this.mockFallback();
    } catch (err) {
      console.warn("[AnadoluScraper] fetch failed, using mock:", err);
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
