import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import { guessCategory, detectTurkishCity } from "../parse-helpers";
import type { EventSource, ScrapedEvent } from "../../types";

/**
 * Yunus Emre Enstitüsü — kültür/akademi etkinlikleri (çalıştay, akademi, söyleşi).
 * JSON API: /api/v1/events. location alanı genelde boş ve etkinliklerin çoğu yurt dışı
 * merkezlerde → yalnızca başlık/özetinde net bir Türk ili geçen etkinlikler alınır
 * (yurt dışı kayıtları feed'e sokmamak için). Ücretsiz.
 */

interface YeeEvent {
  id?: number | string;
  title?: { tr?: string };
  slug?: { tr?: string };
  summary?: { tr?: string };
  dateTime?: string;
  coverImage?: { url?: string };
}

export class YunusEmreScraper extends BaseScraper {
  public readonly source: EventSource = "YUNUS_EMRE";
  public readonly displayName = "Yunus Emre Enstitüsü";
  public readonly baseUrl = "https://www.yee.org.tr";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    const raw = await this.httpGet(`${this.baseUrl}/api/v1/events?page=1&limit=50`, opts.abortSignal, {
      headers: { Accept: "application/json" },
    });
    const json = JSON.parse(raw) as { data?: YeeEvent[] };
    const list = json.data ?? [];
    const now = Date.now();
    const events: ScrapedEvent[] = [];

    for (const e of list) {
      const title = (e.title?.tr ?? "").trim();
      if (!title || !e.dateTime) continue;
      const startsAt = new Date(e.dateTime);
      if (isNaN(startsAt.getTime()) || startsAt.getTime() < now - 86_400_000) continue;

      // Şehir yalnız başlık/özetten çıkarılabiliyorsa al (yurt dışını ele).
      const city = detectTurkishCity(`${title} ${e.summary?.tr ?? ""}`);
      if (!city) continue;

      const slug = e.slug?.tr;
      let image = e.coverImage?.url;
      if (image && image.startsWith("/")) image = this.baseUrl + image;

      events.push({
        source: this.source,
        externalId: `yee-${e.id ?? slug ?? title.slice(0, 24)}`,
        title,
        description: e.summary?.tr?.slice(0, 600),
        category: guessCategory(`${title} ${e.summary?.tr ?? ""}`),
        venue: "Yunus Emre Enstitüsü",
        city,
        startsAt,
        isFree: true,
        ticketUrl: slug ? `${this.baseUrl}/tr/etkinlikler/${slug}` : this.baseUrl,
        imageUrl: image,
        organizer: "Yunus Emre Enstitüsü",
      });
    }

    return events.slice(0, 40);
  }
}
