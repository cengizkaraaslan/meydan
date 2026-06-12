import * as cheerio from "cheerio";
import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import { parseTurkishDate, detectTurkishCity } from "../parse-helpers";
import type { EventSource, ScrapedEvent } from "../../types";

/**
 * Diyanet Eğitim Hizmetleri — sempozyum, konferans, panel, yarışma (dini/ilmi).
 * Kaynak bir HABER akışı (/icerikler/Haberler); çoğu geçmiş idari haber. Bu yüzden SIKI
 * filtre: yalnızca GELECEK etkinlik sinyali ("...düzenlenecek/başlayacak/başvuru") taşıyan,
 * net etkinlik türü (sempozyum/konferans/panel/söyleşi/yarışma/sergi) başlıkları alınır.
 * Kart yalnız yayın tarihi verir (etkinlik tarihi detayda/PDF'de) → startsAt ≈ yayın tarihi.
 */

// Gelecek etkinlik duyurusu sinyali (geçmiş "gerçekleştirildi/başladı/tamamlandı" elenir).
const FUTURE_RE = /(düzenlenecek|başlayacak|yapılacak|açılacak|gerçekleştirilecek|başvuru|son tarih|kayıt|davet ediliyor|ilan edildi)/i;
// Net etkinlik türü.
const KIND_RE = /(sempozyum|konferans|panel|söyleşi|seminer|yarışma|sergi|şenlik|çalıştay|kongre|forum|ödül)/i;
// Geçmiş kipleri (kesin ele).
const PAST_RE = /(gerçekleştirildi|tamamlandı|başladı|sona erdi|düzenlendi|yapıldı|katıldı|ziyaret etti)/i;

export class DiyanetScraper extends BaseScraper {
  public readonly source: EventSource = "DIYANET";
  public readonly displayName = "Diyanet Eğitim Hizmetleri";
  public readonly baseUrl = "https://egitimhizmetleri.diyanet.gov.tr";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    const html = await this.httpGet(`${this.baseUrl}/icerikler/Haberler`, opts.abortSignal, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      insecureTLS: true,
    });
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    $(".post-list-holder .post-outer").each((_, el) => {
      const card = $(el);
      const a = card.find("h2.post-title.entry-title a").first();
      const title = a.text().trim().replace(/\s+/g, " ");
      if (!title) return;
      // Gelecek etkinlik + net tür; geçmiş kipi varsa atla.
      if (PAST_RE.test(title) || !KIND_RE.test(title) || !FUTURE_RE.test(title)) return;

      const href = a.attr("href") ?? "";
      const id = card.attr("itemId") || href.replace(/\D/g, "").slice(-8);
      const externalId = `diyanet-${id}`;
      if (!id || seen.has(externalId)) return;
      seen.add(externalId);

      const dateText = card.find(".post-date").first().text().trim();
      const startsAt = parseTurkishDate(dateText) ?? new Date(Date.now() + 14 * 86_400_000);
      const city = detectTurkishCity(title) ?? "Ankara";
      let image = card.find(".block-image .thumb img").attr("src") || undefined;
      if (image && image.startsWith("/")) image = this.baseUrl + image;

      events.push({
        source: this.source,
        externalId,
        title,
        category: "DINI",
        venue: "Diyanet",
        city,
        startsAt,
        isFree: true,
        ticketUrl: href ? (href.startsWith("http") ? href : this.baseUrl + href) : this.baseUrl,
        imageUrl: image,
        organizer: "Diyanet İşleri Başkanlığı",
      });
    });

    return events.slice(0, 40);
  }
}
