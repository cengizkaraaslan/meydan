import * as cheerio from "cheerio";
import { TicketingScraper } from "../TicketingScraper";
import type { EventCategory, EventSource, ScrapedEvent } from "../../types";

interface CategoryConfig {
  path: string;
  category: EventCategory;
  city: string;
}

const CATEGORIES: CategoryConfig[] = [
  { path: "/tr-tr/muzik",   category: "KONSER",  city: "İstanbul" },
  { path: "/tr-tr/tiyatro", category: "TIYATRO", city: "İstanbul" },
  { path: "/tr-tr/sinema",  category: "DIGER",   city: "İstanbul" },
];

const HTML_ENTITY_MAP: Record<string, string> = {
  "&#252;": "ü", "&#220;": "Ü", "&#246;": "ö", "&#214;": "Ö",
  "&#231;": "ç", "&#199;": "Ç", "&#287;": "ğ", "&#286;": "Ğ",
  "&#350;": "Ş", "&#351;": "ş", "&#304;": "İ", "&#305;": "ı",
  "&amp;": "&", "&quot;": "\"", "&#39;": "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&#?\w+;/g, (m) => HTML_ENTITY_MAP[m] ?? m);
}

export class BiletinialScraper extends TicketingScraper {
  public readonly source: EventSource = "BILETINIAL";
  public readonly displayName = "Biletinial";
  public readonly baseUrl = "https://biletinial.com";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (const cfg of CATEGORIES) {
      try {
        const html = await this.httpGet(`${this.baseUrl}${cfg.path}`);
        const $ = cheerio.load(html);

        $(`a[href^="${cfg.path}/"][title]`).each((_, a) => {
          const $a = $(a);
          const href = $a.attr("href") ?? "";
          if (!href || href === cfg.path || href === `${cfg.path}/`) return;

          const rawTitle = $a.attr("title") ?? "";
          const title = decodeEntities(rawTitle.trim());
          if (!title || title.length < 3) return;

          const slug = href.replace(cfg.path + "/", "").split("?")[0];
          const externalId = `bin-${cfg.category.toLowerCase()}-${slug}`;
          if (seen.has(externalId)) return;
          seen.add(externalId);

          let imageUrl = $a.find("img").first().attr("src") ?? "";
          if (imageUrl && imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;
          else if (imageUrl && !imageUrl.startsWith("http")) {
            imageUrl = new URL(imageUrl, this.baseUrl).toString();
          }

          // Gerçek açıklamayı kart HTML'inden çek; bulunamazsa generic fallback.
          let description = `${title} — bilet bilgisi için Biletinial'a git`;
          const descSelectors = [".event-description", ".subtitle", "p.lead", ".description", ".text", "p"];
          for (const sel of descSelectors) {
            const raw = $a.find(sel).first().text().trim().replace(/\s+/g, " ");
            const cleaned = decodeEntities(raw);
            if (cleaned && cleaned !== title && cleaned.length >= 20) {
              description = cleaned.slice(0, 400);
              break;
            }
          }

          all.push({
            source: this.source,
            externalId,
            title,
            description,
            category: cfg.category,
            venue: "Biletinial üzerinden bilet",
            city: cfg.city,
            startsAt: new Date(Date.now() + 30 * 86400_000),
            isFree: false,
            imageUrl: imageUrl || undefined,
            ticketUrl: new URL(href, this.baseUrl).toString(),
          });
        });
      } catch (err) {
        console.warn(`[BiletinialScraper] ${cfg.path} hatası:`, err instanceof Error ? err.message : err);
      }
    }

    return all;
  }
}
