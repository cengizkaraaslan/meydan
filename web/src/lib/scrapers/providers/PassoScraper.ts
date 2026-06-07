import { TicketingScraper } from "../TicketingScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { MOCK_EVENTS } from "../../mock-data";

export class PassoScraper extends TicketingScraper {
  public readonly source: EventSource = "PASSO";
  public readonly displayName = "Passo";
  public readonly baseUrl = "https://www.passo.com.tr";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    return MOCK_EVENTS.filter((e) => e.source === this.source).map((e) => ({
      source: e.source, externalId: e.externalId, title: e.title, description: e.description,
      category: e.category, venue: e.venue, city: e.city, startsAt: e.startsAt,
      endsAt: e.endsAt, priceMin: e.priceMin, priceMax: e.priceMax, isFree: e.isFree,
      ticketUrl: e.ticketUrl, imageUrl: e.imageUrl, artist: e.artist,
    }));
  }
}
