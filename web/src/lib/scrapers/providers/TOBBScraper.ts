import * as cheerio from "cheerio";
import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import { CITIES, type EventSource, type ScrapedEvent } from "../../types";
import { parseTurkishDate, decodeEntities } from "../parse-helpers";
import { slugify } from "../../utils";

/**
 * TOBB Fuarcılık — Türkiye resmi yıllık Fuar Takvimi.
 * https://fuarlar.tobb.org.tr/FuarTakvimi/{yıl}
 *
 * SSR HTML, tek <table>, ~400 fuar/satır. JS/AJAX yok → httpGet + cheerio yeter.
 * Sütun düzeni (0-index, her satır 16 hücre):
 *   1 başlangıç (gg.aa.yyyy) · 2 bitiş · 3 fuar adı · 4 konu · 5 ürün grupları ·
 *   6 tür (İhtisas/Genel) · 7 fuar yeri (venue) · 8 şehir · 9 düzenleyen ·
 *   13 web · 14 email
 *
 * Fuarlar B2B/mesleki; ziyaretçi girişi genelde ücretsiz → isFree:true, category:"FUAR".
 * İçinde bulunulan + bir sonraki yılın takvimi çekilir (yıl başına ~400 kayıt).
 */

/** "ANKARA", "İSTANBUL", "aydin" → CITIES listesindeki kanonik il adı. */
const CITY_BY_SLUG = new Map(CITIES.map((c) => [slugify(c), c]));
function resolveCity(raw: string): string {
  const cleaned = decodeEntities(raw).trim();
  const canonical = CITY_BY_SLUG.get(slugify(cleaned));
  if (canonical) return canonical;
  // Listede yoksa (yurt dışı / "Online" / çoklu il) baş harf büyük Türkçe başlık yap.
  return cleaned
    .toLocaleLowerCase("tr")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ");
}

/** "www.x.com" / "http://x" → mutlak https URL; boş/geçersizse undefined. */
function normalizeWeb(raw: string | undefined): string | undefined {
  const v = decodeEntities((raw ?? "").trim());
  if (!v || !/[a-z]/i.test(v)) return undefined;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    return new URL(withProto).toString();
  } catch {
    return undefined;
  }
}

export class TOBBScraper extends BaseScraper {
  public readonly source: EventSource = "TOBB";
  public readonly displayName = "TOBB Fuar Takvimi";
  public readonly baseUrl = "https://fuarlar.tobb.org.tr";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    const thisYear = new Date().getFullYear();
    const years = [thisYear, thisYear + 1];
    const cutoff = Date.now() - 86400_000; // bitmiş fuarları (end < dün) atla
    const all: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (const year of years) {
      let html: string;
      try {
        html = await this.httpGet(`${this.baseUrl}/FuarTakvimi/${year}`);
      } catch (err) {
        // Gelecek yıl takvimi henüz yayında olmayabilir (404) → sessiz geç.
        console.warn(`[TOBBScraper] ${year} alınamadı:`, err instanceof Error ? err.message : err);
        continue;
      }

      const $ = cheerio.load(html);
      $("table tr").each((_, tr) => {
        const cells = $(tr)
          .find("td")
          .map((__, td) => decodeEntities($(td).text()).replace(/\s+/g, " ").trim())
          .get();
        if (cells.length < 10) return; // başlık/ayraç satırı

        const startsAt = parseTurkishDate(cells[1]);
        if (!startsAt) return; // 1. hücre tarih değilse veri satırı değil
        const endsAt = parseTurkishDate(cells[2]) ?? undefined;
        if ((endsAt ?? startsAt).getTime() < cutoff) return; // bitmiş

        const title = cells[3];
        if (!title || title.length < 3) return;

        const subject = cells[4];
        const type = cells[6];
        const venueRaw = cells[7];
        const city = resolveCity(cells[8] || "");
        const organizer = cells[9];
        const website = normalizeWeb(cells[13]);

        const externalId = `${slugify(title).slice(0, 48)}-${cells[1].replace(/\D/g, "")}`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        const descParts = [
          subject && `Konu: ${subject}`,
          type && `Tür: ${type}`,
          organizer && `Düzenleyen: ${organizer}`,
        ].filter(Boolean);

        all.push({
          source: this.source,
          externalId,
          title,
          description: descParts.length ? descParts.join(" · ") : undefined,
          category: "FUAR",
          venue: venueRaw || city,
          city,
          startsAt,
          endsAt,
          isFree: true, // ziyaretçi girişi genelde ücretsiz; bilet fiyatı yok
          ticketUrl: website,
        });
      });
    }

    return typeof opts.maxItems === "number" ? all.slice(0, opts.maxItems) : all;
  }
}
