import { BaseScraper } from "./BaseScraper";
import type { ScrapedEvent } from "../types";

/**
 * University scrapers (Anadolu, Bilkent, İTÜ, Boğaziçi, ...).
 * University events are almost always free for students/public; subclasses
 * may override isFree if a specific event has a fee.
 */
export abstract class UniversityScraper extends BaseScraper {
  protected override normalize(e: ScrapedEvent): ScrapedEvent {
    const base = super.normalize(e);
    return {
      ...base,
      isFree: e.priceMin == null && e.priceMax == null ? true : base.isFree,
      priceMin: e.isFree ? 0 : base.priceMin,
      priceMax: e.isFree ? 0 : base.priceMax,
    };
  }
}
