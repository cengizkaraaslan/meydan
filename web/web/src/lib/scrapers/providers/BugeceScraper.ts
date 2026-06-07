import * as cheerio from "cheerio";
import { TicketingScraper } from "../TicketingScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { guessCategory, absUrl } from "../parse-helpers";

/**
 * Bugece (bugece.co) — gece hayatı / elektronik müzik etkinlikleri.
 * İstanbul + Ankara + İzmir + Bodrum + Çeşme. Projedeki tek "nightlife" kaynağı.
 *
 * SSR HTML. Her şehir için /tr/browse/{slug}/events sayfası, kartlar:
 *   <a title="{başlık}" href="/tr/event/{slug}-{MM-DD-YY}--{id}"> ... <img> </a>
 * Tarih event slug'ının içinde (MM-DD-YY); başlık <a title> attr'sinde.
 */
const CITY_PATHS: Array<{ slug: string; city: string }> = [
  { slug: "istanbul", city: "İstanbul" },
  { slug: "ankara", city: "Ankara" },
  { slug: "izmir", city: "İzmir" },
  { slug: "bodrum", city: "Muğla" },
  { slug: "cesme", city: "İzmir" },
];

export class BugeceScraper extends TicketingScraper {
  public readonly source: EventSource = "BUGECE";
  public readonly displayName = "Bugece";
  public readonly baseUrl = "https://bugece.co";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (const { slug, city } of CITY_PATHS) {
      try {
        const html = await this.httpGet(`${this.baseUrl}/tr/browse/${slug}/events`);
        const $ = cheerio.load(html);

        $('a[href^="/tr/event/"]').each((_, a) => {
          const $a = $(a);
          const href = $a.attr("href") ?? "";
          // slug sonu: -MM-DD-YY--{hexid}
          const m = href.match(/-(\d{2})-(\d{2})-(\d{2})--([0-9a-f]+)$/i);
          if (!m) return;
          const [, mm, dd, yy, id] = m;
          if (seen.has(id)) return;
          seen.add(id);

          const title = ($a.attr("title") ?? "").trim().replace(/\s+/g, " ");
          if (!title || title.length < 3) return;

          // Gece etkinliği — 21:00 varsayılan
          const startsAt = new Date(2000 + Number(yy), Number(mm) - 1, Number(dd), 21, 0);

          const cat = guessCategory(title);
          const imageUrl = absUrl(
            $a.find("img").first().attr("src") ?? $a.find("img").first().attr("data-src"),
            this.baseUrl,
          );

          all.push({
            source: this.source,
            externalId: `bugece-${id}`,
            title,
            category: cat === "DIGER" ? "KONSER" : cat,
            venue: city,
            city,
            startsAt,
            isFree: false,
            imageUrl,
            ticketUrl: new URL(href, this.baseUrl).toString(),
          });
        });
      } catch (err) {
        console.warn(`[BugeceScraper] ${slug} hatası:`, err instanceof Error ? err.message : err);
      }
    }

    return all;
  }
}
