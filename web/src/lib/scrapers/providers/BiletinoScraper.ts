import * as cheerio from "cheerio";
import { BaseScraper } from "../BaseScraper";
import type { EventSource, ScrapedEvent } from "../../types";
import { parseTurkishDate, guessCategory, decodeEntities, absUrl } from "../parse-helpers";

/**
 * Biletino (biletino.com) — atölye / eğitim / sosyal etkinlik / konser.
 * Kullanıcı tarafından oluşturulan etkinlikler; çoğu küçük ölçekli, bir kısmı ücretsiz.
 *
 * SSR HTML. Şehir sayfası kartları:
 *   <a href="/tr/e-{id}/{slug}/" class="card-body event-url">
 *     <h3 class="title">{başlık}</h3>
 *     <p class="card-text date">13 Haziran Cumartesi</p>
 *     <p class="card-text location">Sarıyer, İstanbul</p>
 *   </a>
 * Görsel ayrı `a.card-image` içindeki <img data-src/alt>.
 *
 * Not: Liste kartında fiyat yok → isFree güvenilir tespit edilemiyor, varsayılan false.
 * Ücretsiz filtresi ileride /tr/city/{city}/?free ile ayrı çekilebilir.
 */
const LISTINGS: Array<{ path: string; city: string; online?: boolean }> = [
  { path: "/tr/city/istanbul/", city: "İstanbul" },
  { path: "/tr/city/ankara/", city: "Ankara" },
  { path: "/tr/city/izmir/", city: "İzmir" },
  // Çevrimiçi (online) etkinlikler — şehir bağımsız, aynı kart yapısı.
  { path: "/tr/online/", city: "Online", online: true },
];

export class BiletinoScraper extends BaseScraper {
  public readonly source: EventSource = "BILETINO";
  public readonly displayName = "Biletino";
  public readonly baseUrl = "https://biletino.com";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (const { path, city, online } of LISTINGS) {
      try {
        const html = await this.httpGet(`${this.baseUrl}${path}`);
        const $ = cheerio.load(html);

        $('a.card-body[href^="/tr/e-"]').each((_, a) => {
          const $a = $(a);
          const href = $a.attr("href") ?? "";
          const idMatch = href.match(/^\/tr\/(e-[a-z0-9]+)\//i);
          const externalId = `biletino-${idMatch?.[1] ?? href.replace(/[^a-z0-9]/gi, "").slice(-12)}`;
          if (seen.has(externalId)) return;
          seen.add(externalId);

          const title = decodeEntities($a.find("h3.title").first().text().trim().replace(/\s+/g, " "));
          if (!title || title.length < 3) return;

          const dateRaw = $a.find("p.date").first().text().trim().replace(/\s+/g, " ");
          const startsAt = parseTurkishDate(dateRaw) ?? new Date(Date.now() + 14 * 86400_000);

          const locationRaw = decodeEntities($a.find("p.location").first().text().trim().replace(/\s+/g, " "));
          const parts = locationRaw.split(",").map((p) => p.trim()).filter(Boolean);
          // /tr/online/ sayfası KARMA: gerçekten online (konumsuz / "online" yazan) +
          // fiziksel festivaller bir arada. Yalnız gerçekten online olanı "Online"
          // işaretle; fiziksel olanın şehrini konumdan çıkar (yanlış etiketleme olmasın).
          // NOT: Biletino'nun /tr/online/ sayfası gerçekte KARMA (çoğu fiziksel öne çıkan
          // konser/festival, gerçek şehirli). Online sinyali başlık + slug(href) + konumdan
          // yakalanır ("Online ... Eğitimi" gibi); yoksa fiziksel sayılıp şehrine atanır.
          const reallyOnline =
            online &&
            (!locationRaw ||
              /\bonline\b|çevrimiçi|cevrimici|webinar|canlı yayın|canli yayin|zoom/i.test(
                `${title} ${locationRaw} ${href}`,
              ));
          const eventCity = reallyOnline ? "Online" : online ? parts[parts.length - 1] || city : city;
          const district = reallyOnline ? undefined : parts.length > 1 ? parts[0] : undefined;
          const venue = reallyOnline ? "Çevrimiçi" : locationRaw || eventCity;

          // Görsel: aynı kartı işaret eden card-image bağlantısındaki img
          const imageUrl = absUrl(
            $a
              .closest(".product, .swiper-slide, div")
              .find('a.card-image img, a[href="' + href + '"] img')
              .first()
              .attr("data-src"),
            this.baseUrl,
          );

          all.push({
            source: this.source,
            externalId,
            title,
            category: guessCategory(`${title} ${venue}`),
            venue,
            city: eventCity,
            district,
            startsAt,
            isFree: false,
            imageUrl,
            ticketUrl: new URL(href, this.baseUrl).toString(),
          });
        });
      } catch (err) {
        console.warn(`[BiletinoScraper] ${path} hatası:`, err instanceof Error ? err.message : err);
      }
    }

    return all;
  }
}
