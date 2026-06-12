import * as cheerio from "cheerio";
import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import { guessCategory, parseTurkishDate } from "../parse-helpers";
import type { EventSource, ScrapedEvent } from "../../types";

/**
 * Yapı Kredi Kültür Sanat (vakıf) — söyleşi, atölye, sergi, çocuk etkinlikleri.
 * Server-side HTML, ?year=&month= ile aylık filtre. Tam tarih, kart linkindeki
 * ?date=g.AA.yyyy parametresinden alınır. Etkinlikler ücretsiz (rezervasyonlu), İstanbul.
 */
export class YapiKrediKulturScraper extends BaseScraper {
  public readonly source: EventSource = "YKY_KULTUR";
  public readonly displayName = "Yapı Kredi Kültür Sanat";
  public readonly baseUrl = "https://sanat.ykykultur.com.tr";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();
    const now = new Date();

    // İçinde bulunulan ay + sonraki 2 ay.
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const url = `${this.baseUrl}/etkinlikler?year=${d.getFullYear()}&month=${d.getMonth() + 1}`;
      let html: string;
      try {
        html = await this.httpGet(url, opts.abortSignal);
      } catch {
        continue;
      }
      const $ = cheerio.load(html);

      $("ul.event-list > li.clearfix").each((_, el) => {
        const li = $(el);
        const share = li.find(".social-sharing-content");
        const title = (share.find(".title").text().trim() || li.find(".mask .spot h2").first().text().trim()).replace(/\s+/g, " ");
        if (!title) return;

        const href = li.find('a[href^="/etkinlikler/"]').attr("href") ?? "";
        const dateParam = href.match(/date=([\d.]+)/)?.[1] ?? "";
        const startsAt = parseTurkishDate(dateParam);
        if (!startsAt) return;

        const slug = href.split("?")[0].split("/").pop() ?? "";
        const externalId = `yky-${slug || dateParam}`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        const caption = share.find(".caption").text().trim(); // kategori metni
        const venueRaw = li.find(".hover-panel .spot h4").filter((_i, h) => /yer\s*:/i.test($(h).text())).first().text();
        const venue = venueRaw.replace(/yer\s*:/i, "").trim() || "Yapı Kredi Kültür Sanat";
        let image = share.find(".image").text().trim() || li.find("img").attr("src") || undefined;
        if (image && image.startsWith("//")) image = "https:" + image;
        const link = share.find(".url").text().trim() || (href ? this.baseUrl + href : this.baseUrl);

        events.push({
          source: this.source,
          externalId,
          title,
          category: guessCategory(`${title} ${caption} ${venue}`),
          venue,
          city: "İstanbul",
          startsAt,
          isFree: true,
          ticketUrl: link,
          imageUrl: image,
          organizer: "Yapı Kredi Kültür Sanat",
        });
      });
    }

    return events.slice(0, 60);
  }
}
