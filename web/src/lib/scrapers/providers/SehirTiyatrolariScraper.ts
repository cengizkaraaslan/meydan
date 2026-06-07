import * as cheerio from "cheerio";
import { MunicipalityScraper } from "../MunicipalityScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { decodeEntities, humanizeSlug, absUrl } from "../parse-helpers";

/**
 * İBB Şehir Tiyatroları (sehirtiyatrolari.ibb.istanbul) — ücretsiz/uygun fiyatlı
 * tiyatro repertuarı. /takvim sayfası oyunları liste olarak veriyor:
 *
 *   <a href="/oyun/{slug}">{Oyun Başlığı}</a>
 *
 * Takvim hücreleri AJAX (yn_calendar_day) — oyun bazlı tarih güvenilir değil;
 * bu yüzden repertuar listesini çekip her oyunu yaklaşık (gelecek) tarihle
 * yayınlıyoruz. Detay/seans tarihleri ileride /oyun/{slug} detayından alınabilir.
 */
export class SehirTiyatrolariScraper extends MunicipalityScraper {
  public readonly source: EventSource = "SEHIR_TIYATROLARI";
  public readonly displayName = "İBB Şehir Tiyatroları";
  public readonly baseUrl = "https://sehirtiyatrolari.ibb.istanbul";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    try {
      const html = await this.httpGet(`${this.baseUrl}/takvim`);
      const $ = cheerio.load(html);

      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();
      let idx = 0;

      $('a[href^="/oyun/"]').each((_, a) => {
        const $a = $(a);
        const href = $a.attr("href") ?? "";
        const slug = href.replace(/^\/oyun\//, "").replace(/\/$/, "");
        if (!slug) return; // "/oyun/" kökü
        if (seen.has(slug)) return;
        seen.add(slug);

        // Başlık link metninde; yoksa slug'dan üret
        let title = decodeEntities($a.text().trim().replace(/\s+/g, " "));
        if (!title || title.length < 3) title = humanizeSlug(slug);

        // Repertuar — yaklaşık tarih (her oyun farklı güne dağıt, hepsi gelecekte)
        const startsAt = new Date(Date.now() + (3 + idx * 2) * 86400_000);
        startsAt.setHours(20, 0, 0, 0);
        idx++;

        const imageUrl = absUrl($a.find("img").first().attr("src") ?? $a.find("img").first().attr("data-src"), this.baseUrl);

        events.push({
          source: this.source,
          externalId: `sehirt-${slug}`,
          title,
          category: "TIYATRO",
          venue: "İBB Şehir Tiyatroları",
          city: "İstanbul",
          startsAt,
          isFree: true,
          imageUrl,
          ticketUrl: new URL(href, this.baseUrl).toString(),
        });
      });

      return events;
    } catch (err) {
      console.warn("[SehirTiyatrolariScraper] fetch hatası:", err instanceof Error ? err.message : err);
      return [];
    }
  }
}
