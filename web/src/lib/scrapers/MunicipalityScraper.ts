import { BaseScraper } from "./BaseScraper";
import type { ScrapedEvent } from "../types";

/**
 * Municipality scrapers (İBB, Ankara BB, İzmir BB, ...).
 * Their events are usually free; subclasses override isFree only when there's a fee.
 */
export abstract class MunicipalityScraper extends BaseScraper {
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
