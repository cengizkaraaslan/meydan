import * as cheerio from "cheerio";
import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import type { EventCategory } from "../../types";
import { absUrl, guessCategory } from "../parse-helpers";

/**
 * eskisehirtrend.com scraper.
 *
 * Yapı (SSR — tüm veri liste sayfasında, detay fetch GEREKMEZ):
 *   - Liste: https://eskisehirtrend.com/etkinlikler
 *   - Her kart: <a href="/etkinlikler/{slug}"> .agenda-card içinde
 *       <time datetime="2026-11-14T22:00:00+03:00"> → kesin ISO tarih+saat
 *       .agenda-price "1.200 ₺"  → fiyat (TR binlik ayraç '.')
 *       <h3> başlık
 *       .agenda-location mekan
 *       img.agenda-img görsel (relative → absUrl)
 *   - Ayrıca JSON-LD ItemList var ama tarih/fiyat içermiyor → kart markup'ı tek kaynak.
 *
 * Etkinlikler Eskişehir'de, biletli (₺) → isFree false, priceMin/Max set edilir.
 */

const BASE = "https://eskisehirtrend.com";
const LISTING_URL = `${BASE}/etkinlikler`;

/** "1.200 ₺" → 1200 ; "219 ₺" → 219 ; binlik ayracı '.' atılır. */
function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ortak guessCategory "gösteri" → TIYATRO eşlemesini stand-up'tan önce yapıyor;
 * bu sitede çok sayıda "... Stand Up Gösterisi" var. Stand-up'ı önce ele al.
 */
function categorize(title: string, venue: string): EventCategory {
  if (/stand[\s-]?up/i.test(title)) return "STANDUP";
  return guessCategory(`${title} ${venue}`);
}

export class EskisehirTrendScraper extends BaseScraper {
  public readonly source: EventSource = "ESKISEHIR_TREND";
  public readonly displayName = "Eskişehir Trend";
  public readonly baseUrl = BASE;

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    const html = await this.httpGet(LISTING_URL, opts.abortSignal);
    const $ = cheerio.load(html);

    const seen = new Set<string>();
    const events: ScrapedEvent[] = [];

    $("a[href^='/etkinlikler/']").each((_, anchor) => {
      const $a = $(anchor);
      const $card = $a.find(".agenda-card");
      if ($card.length === 0) return; // sadece kart linkleri (nav/footer linkleri değil)

      const href = $a.attr("href") ?? "";
      const slug = href.replace(/^\/etkinlikler\//, "").replace(/\/$/, "").trim();
      if (!slug) return;
      const externalId = `estrend-${slug}`;
      if (seen.has(externalId)) return;
      seen.add(externalId);

      const title = $card.find("h3").first().text().trim().replace(/\s+/g, " ");
      if (!title) return;

      // Tarih: <time datetime="ISO"> en güvenilir; yoksa atla
      const dt = $card.find("time[datetime]").first().attr("datetime")?.trim();
      const startsAt = dt ? new Date(dt) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) return;

      const venueRaw = $card.find(".agenda-location").first().text().trim().replace(/\s+/g, " ");
      const venue = venueRaw || "Eskişehir";

      const priceText = $card.find(".agenda-price").first().text().trim();
      const price = parsePrice(priceText);
      const isFree = /ücretsiz|ucretsiz|free/i.test(priceText);

      const imgSrc = $card.find("img.agenda-img").first().attr("src");
      const imageUrl = absUrl(imgSrc, BASE);

      events.push({
        source: this.source,
        externalId,
        title,
        category: categorize(title, venue),
        venue,
        city: "Eskişehir",
        startsAt,
        isFree,
        priceMin: isFree ? 0 : price ?? undefined,
        priceMax: isFree ? 0 : price ?? undefined,
        imageUrl,
        ticketUrl: new URL(href, BASE).toString(),
      });
    });

    return events;
  }
}
