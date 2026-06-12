import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import { guessCategory, parseTurkishDate } from "../parse-helpers";
import type { EventSource, ScrapedEvent } from "../../types";

/**
 * Müze Gazhane (İBB, Kadıköy) — atölye, konser, söyleşi, sergi.
 * WordPress REST API: /wp-json/wp/v2/etkinlikler. Arşivde 2800+ kayıt (geçmiş dahil) →
 * yalnız başlangıç tarihi gelecekte olanlar alınır. ACF alanları yapısal veriyi verir.
 */

interface WpAcf {
  etkinlik_adi?: string;
  etkinlik_baslangic_tarihi_?: string; // "2026-06-29 19:00:00"
  etkinlik_konumu?: string;
  etkinlik_kategorisi?: string;
  etkinlik_ucreti_?: string; // "Ücretsiz"
  bilet_satis_url?: string;
  etkinlik_aciklamasi?: string;
}
interface WpEvent {
  id?: number;
  link?: string;
  title?: { rendered?: string };
  acf?: WpAcf;
  _embedded?: { "wp:featuredmedia"?: { source_url?: string }[] };
}

export class GazhaneScraper extends BaseScraper {
  public readonly source: EventSource = "GAZHANE";
  public readonly displayName = "Müze Gazhane";
  public readonly baseUrl = "https://muzegazhane.istanbul";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    const raw = await this.httpGet(
      `${this.baseUrl}/wp-json/wp/v2/etkinlikler?per_page=100&orderby=date&order=desc&_embed=wp:featuredmedia`,
      opts.abortSignal,
      { headers: { Accept: "application/json" } },
    );
    const list = JSON.parse(raw) as WpEvent[];
    const now = Date.now();
    const events: ScrapedEvent[] = [];

    for (const e of Array.isArray(list) ? list : []) {
      const acf = e.acf ?? {};
      const title = (acf.etkinlik_adi || e.title?.rendered || "").replace(/<[^>]+>/g, "").trim();
      const dateRaw = acf.etkinlik_baslangic_tarihi_ ?? "";
      if (!title || !dateRaw) continue;
      const startsAt = parseTurkishDate(dateRaw);
      if (!startsAt || startsAt.getTime() < now - 86_400_000) continue; // sadece gelecek

      const ucret = (acf.etkinlik_ucreti_ ?? "").toLocaleLowerCase("tr");
      const isFree = !ucret || ucret.includes("ücretsiz") || ucret.includes("ucretsiz");
      const kat = acf.etkinlik_kategorisi ?? "";

      events.push({
        source: this.source,
        externalId: `gazhane-${e.id}`,
        title,
        description: acf.etkinlik_aciklamasi?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
        category: guessCategory(`${title} ${kat}`),
        venue: acf.etkinlik_konumu?.trim() || "Müze Gazhane",
        city: "İstanbul",
        district: "Kadıköy",
        startsAt,
        isFree,
        ticketUrl: acf.bilet_satis_url || e.link || this.baseUrl,
        imageUrl: e._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
        organizer: "Müze Gazhane",
      });
    }

    return events.slice(0, 60);
  }
}
