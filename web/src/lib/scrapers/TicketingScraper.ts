import { BaseScraper } from "./BaseScraper";
import type { ScrapedEvent } from "../types";

/**
 * Paid-ticket marketplaces (Biletix, Bubilet, Mobilet, Passo).
 * Subclasses fetch HTML/JSON listings and emit ScrapedEvent[] with priceMin/priceMax.
 */
export abstract class TicketingScraper extends BaseScraper {
  protected override normalize(e: ScrapedEvent): ScrapedEvent {
    const base = super.normalize(e);
    if (base.priceMin != null && base.priceMax != null && base.priceMin > base.priceMax) {
      const tmp = base.priceMin;
      base.priceMin = base.priceMax;
      base.priceMax = tmp;
    }
    return { ...base, isFree: false };
  }
}
