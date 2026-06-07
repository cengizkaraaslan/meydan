import { TicketingScraper } from "../TicketingScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { MOCK_EVENTS } from "../../mock-data";

export class BiletixScraper extends TicketingScraper {
  public readonly source: EventSource = "BILETIX";
  public readonly displayName = "Biletix";
  public readonly baseUrl = "https://www.biletix.com";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    return MOCK_EVENTS.filter((e) => e.source === this.source).map((e) => ({
      source: e.source, externalId: e.externalId, title: e.title, description: e.description,
      category: e.category, venue: e.venue, city: e.city, startsAt: e.startsAt,
      endsAt: e.endsAt, priceMin: e.priceMin, priceMax: e.priceMax, isFree: e.isFree,
      ticketUrl: e.ticketUrl, imageUrl: e.imageUrl, artist: e.artist,
    }));
    // TODO: gerçek scraping aktif olduğunda:
    //   const html = await this.httpGet(`${this.baseUrl}/etkinlik`);
    //   const $ = cheerio.load(html);
    //   parse $(".event-card") into ScrapedEvent[]
  }
}
