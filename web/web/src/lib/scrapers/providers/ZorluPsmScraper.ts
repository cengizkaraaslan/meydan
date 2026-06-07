import * as cheerio from "cheerio";
import { BaseScraper } from "../BaseScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { parseTurkishDate, guessCategory, absUrl } from "../parse-helpers";

/**
 * Zorlu PSM (zorlupsm.com) — konser / tiyatro / opera / müzikal.
 * SSR HTML. Etkinlikler tarih başlıklarıyla gruplanmış:
 *
 *   <b class="... event-list-date">30 MAYIS CUMARTESİ</b>
 *   <div class="event-list-card"> ...
 *       <h2 class="font-size-l">{başlık}</h2>
 *       <div class="location"><p>{mekan}</p> ... <b class="hour">19:00</b></div>
 *       <a class="label-hastag">ÜCRETSİZ</a>  (varsa)
 *       <a href="/etkinlikler/{slug}?p={uuid}">
 *   </div>
 *
 * Tarih kartta değil başlıkta → belge sırasında en son görülen başlık takip edilir.
 * Ücretli/ücretsiz karışık olduğu için TicketingScraper değil BaseScraper.
 */
export class ZorluPsmScraper extends BaseScraper {
  public readonly source: EventSource = "ZORLU_PSM";
  public readonly displayName = "Zorlu PSM";
  public readonly baseUrl = "https://www.zorlupsm.com";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    try {
      const html = await this.httpGet(`${this.baseUrl}/etkinlikler`);
      const $ = cheerio.load(html);

      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();
      let currentDate: Date | null = null;

      $(".event-list-date, .event-list-card").each((_, el) => {
        const $el = $(el);

        if ($el.hasClass("event-list-date")) {
          currentDate = parseTurkishDate($el.text());
          return;
        }

        const href =
          $el
            .find('a[href*="/etkinlikler/"]')
            .filter((_i, a) => ($(a).attr("href") ?? "").includes("?p="))
            .first()
            .attr("href") ?? "";
        if (!href) return;

        const title = $el.find("h2").first().text().trim().replace(/\s+/g, " ");
        if (!title || title.length < 3) return;

        const idMatch = href.match(/p=([0-9a-f-]+)/i);
        const externalId = `zorlu-${idMatch?.[1]?.slice(0, 12) ?? href.replace(/[^a-z0-9]/gi, "").slice(-12)}`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        const hour = $el.find("b.hour").first().text().trim();
        let startsAt = currentDate ? new Date(currentDate) : new Date(Date.now() + 7 * 86400_000);
        const t = hour.match(/(\d{1,2})[:.](\d{2})/);
        if (currentDate && t) startsAt.setHours(Number(t[1]), Number(t[2]), 0, 0);

        const venue =
          $el.find(".location p").not(".slash").first().text().trim().replace(/\s+/g, " ") ||
          "Zorlu PSM";
        const isFree = $el
          .find(".label-hastag")
          .text()
          .toLocaleLowerCase("tr")
          .includes("ücretsiz");

        const descRaw = $el.find(".overflow-content p").first().text().trim().replace(/\s+/g, " ");
        const description = descRaw && descRaw !== title && descRaw.length >= 20 ? descRaw.slice(0, 400) : undefined;

        const imageUrl = absUrl($el.find("img").first().attr("src"), this.baseUrl);

        events.push({
          source: this.source,
          externalId,
          title,
          description,
          category: guessCategory(`${title} ${venue}`),
          venue,
          city: "İstanbul",
          startsAt,
          isFree,
          imageUrl,
          ticketUrl: new URL(href, this.baseUrl).toString(),
        });
      });

      return events;
    } catch (err) {
      console.warn("[ZorluPsmScraper] fetch hatası:", err instanceof Error ? err.message : err);
      return [];
    }
  }
}
