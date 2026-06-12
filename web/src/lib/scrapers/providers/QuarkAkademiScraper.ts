import * as cheerio from "cheerio";
import { BaseScraper } from "../BaseScraper";
import { parseTurkishDate } from "../parse-helpers";
import type { EventSource, ScrapedEvent } from "../../types";

/**
 * Quark Akademi Danışmanlık — ÜCRETLİ atölye/eğitim listesi (blog şablonu).
 * Kaynak: https://quarkakademidanismanlik.com.tr/blog.html
 *
 * Her etkinlik (.blog_item):
 *   <div class="blog_item_img"><img class="card-img" src="img/educations/2026-06-1314.png"></div>
 *   <div class="blog_details">
 *     <a href=""><h2>KONYA</h2><h3>13 - 14 Haziran</h3></a>
 *     <p>Quark Enerji ile Öze Yolculuk Uygulayıcı Atölyesi.</p>
 *   </div>
 * Detay linki ve fiyat yok → isFree: false (ücretli), ticketUrl = blog sayfası.
 * Tarih en güvenilir görsel adından (YYYY-MM-DD…) çözülür; yoksa h3 metninden.
 */

interface AnyCheerio {
  find: (s: string) => AnyCheerio;
  first: () => AnyCheerio;
  text: () => string;
  attr: (n: string) => string | undefined;
  each: (cb: (i: number, el: unknown) => void) => AnyCheerio;
  length: number;
}

/** Quark Akademi iletişim/sosyal bilgileri (sitenin footer'ından) — artık açıklamaya
 *  gömmek yerine etkinliğin yapılandırılmış alanlarına (phone/instagram/facebook/website)
 *  set ediliyor; doluysa etkinlik detayında ayrı linkler olarak gösterilir.
 *  Sitede herkese açık e-posta (mailto) yok → telefon/WhatsApp + sosyal hesaplar. */
const QUARK_CONTACT = {
  phone: "0544 226 98 98",
  instagram: "https://instagram.com/quark_biyoenerji_hasan_kalkan",
  facebook: "https://facebook.com/quarkakademidanismanlik",
  website: "https://quarkakademidanismanlik.com.tr",
} as const;

/** "KONYA" / "ESKİŞEHİR" → "Konya" / "Eskişehir" (Türkçe locale). */
function titleCaseCity(s: string): string {
  const t = s.trim().toLocaleLowerCase("tr");
  return t ? t.charAt(0).toLocaleUpperCase("tr") + t.slice(1) : s.trim();
}

export class QuarkAkademiScraper extends BaseScraper {
  public readonly source: EventSource = "QUARK_AKADEMI";
  public readonly displayName = "Quark Akademi";
  public readonly baseUrl = "https://quarkakademidanismanlik.com.tr";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    try {
      const html = await this.httpGet(`${this.baseUrl}/blog.html`);
      const $ = cheerio.load(html);
      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();

      ($(".blog_item") as unknown as AnyCheerio).each((index, el) => {
        const item = $(el as never) as unknown as AnyCheerio;
        const city = titleCaseCity(item.find(".blog_details h2").first().text());
        const dateText = item.find(".blog_details h3").first().text().trim();
        const rawTitle = item.find(".blog_details p").first().text().trim().replace(/\s+/g, " ").replace(/\.+$/, "");
        const baseTitle = rawTitle || "Quark Akademi Atölyesi";
        const title = (city ? `${baseTitle} — ${city}` : baseTitle).slice(0, 160);

        const imgSrc = item.find("img").first().attr("src") ?? "";
        // Görsel adı tarihi kodluyor: "img/educations/2026-06-1314.png" → 2026-06-13.
        const fromImg = imgSrc.match(/(\d{4})-(\d{2})-(\d{2})/);
        const startsAt =
          (fromImg ? new Date(Number(fromImg[1]), Number(fromImg[2]) - 1, Number(fromImg[3]), 10, 0) : null) ??
          parseTurkishDate(`${dateText} ${fromImg?.[1] ?? new Date().getFullYear()}`) ??
          new Date(Date.now() + 7 * 86400_000);

        const idBase = (imgSrc.split("/").pop() ?? "").replace(/\.\w+$/, "") || `${city}-${index}`;
        const externalId = `quark-${idBase.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
        if (!baseTitle || seen.has(externalId)) return;
        seen.add(externalId);

        events.push({
          source: this.source,
          externalId,
          title,
          description: `${baseTitle} (ücretli atölye).`.slice(0, 400),
          organizer: "Quark Akademi Danışmanlık",
          category: "ATOLYE",
          venue: city || "Quark Akademi",
          city: city || "Türkiye",
          startsAt,
          isFree: false, // ücretli atölye (sitede fiyat belirtilmemiş)
          imageUrl: imgSrc ? new URL(imgSrc, this.baseUrl).toString() : undefined,
          ticketUrl: `${this.baseUrl}/blog.html`,
          phone: QUARK_CONTACT.phone,
          instagram: QUARK_CONTACT.instagram,
          facebook: QUARK_CONTACT.facebook,
          website: QUARK_CONTACT.website,
        });
      });

      return events.slice(0, 60);
    } catch (err) {
      console.warn("[QuarkAkademiScraper] fetch hatası:", err instanceof Error ? err.message : err);
      return [];
    }
  }
}
