import * as cheerio from "cheerio";
import { MunicipalityScraper } from "../MunicipalityScraper";
import { guessCategory, isAdminNotice } from "../parse-helpers";
import type { EventSource, ScrapedEvent } from "../../types";

/**
 * Odunpazarı Belediyesi (Eskişehir) etkinlik scraper'ı.
 * Kaynak: https://www.odunpazari.bel.tr/guncel/etkinlikler
 *
 * Site yapısı (her etkinlik):
 *   <a class="news-list-image" href="/guncel/etkinlikler/<slug>"><img src="..."></a>
 *   <span><a>BAŞLIK</a> <b>Tarih :</b> 18 Haz 2026 <b>Yer :</b> ... <b>Saat :</b> 18:15</span>
 *   <a href="...">Devamını oku</a>
 * Başlık + Tarih/Yer/Saat aynı <span> içinde; tarih KISALTILMIŞ ay ("Haz") kullanıyor →
 * generic parser (tam ay adı bekler) çözemediği için concrete scraper.
 */

/** Türkçe kısaltılmış/tam ay → 0-index (ilk 3 harf yeterli: "haz", "haziran" ikisi de 5). */
const TR_MONTH: Record<string, number> = {
  oca: 0, şub: 1, sub: 1, mar: 2, nis: 3, may: 4, haz: 5,
  tem: 6, ağu: 7, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
};

/** "18 Haz 2026" (+ opsiyonel "18:15") → yerel Date. Çözemezse null. */
function parseOdunDate(dateText: string, timeText?: string): Date | null {
  const m = dateText.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
  if (!m) return null;
  const month = TR_MONTH[m[2].toLocaleLowerCase("tr").slice(0, 3)];
  if (month == null) return null;
  const t = timeText?.match(/(\d{1,2})[:.](\d{2})/);
  return new Date(Number(m[3]), month, Number(m[1]), t ? Number(t[1]) : 20, t ? Number(t[2]) : 0);
}

interface AnyCheerio {
  find: (s: string) => AnyCheerio;
  first: () => AnyCheerio;
  text: () => string;
  attr: (n: string) => string | undefined;
  nextAll: (s: string) => AnyCheerio;
  each: (cb: (i: number, el: unknown) => void) => AnyCheerio;
  length: number;
}

export class OdunpazariScraper extends MunicipalityScraper {
  public readonly source: EventSource = "MUNI_ODUNPAZARI";
  public readonly displayName = "Odunpazarı Belediyesi";
  public readonly baseUrl = "https://www.odunpazari.bel.tr";
  public readonly city = "Eskişehir";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    try {
      const html = await this.httpGet(`${this.baseUrl}/guncel/etkinlikler`);
      const $ = cheerio.load(html);
      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();

      ($("a.news-list-image") as unknown as AnyCheerio).each((index, el) => {
        const a = $(el as never) as unknown as AnyCheerio;
        const href = a.attr("href") ?? "";
        if (!href.includes("/etkinlikler/")) return; // yalnız etkinlik detay linkleri

        // Başlık + Tarih/Yer/Saat aynı <span> metninde: "<BAŞLIK> Tarih : … Yer : … Saat : …"
        const span = a.nextAll("span").first().text().replace(/\s+/g, " ").trim();
        if (!span) return;
        const title = span.split(/Tarih\s*:/i)[0].trim().slice(0, 160);
        if (!title || title.length < 3 || isAdminNotice(title)) return;

        const externalId = `muni_odunpazari-${href.replace(/[^a-z0-9]/gi, "").slice(-16) || index}`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        const dateM = span.match(/Tarih\s*:?\s*(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4})/i);
        const timeM = span.match(/Saat\s*:?\s*(\d{1,2}[:.]\d{2})/i);
        const venueM = span.match(/Yer\s*:?\s*(.+?)\s*(?:Saat\s*:|$)/i);
        const startsAt =
          (dateM ? parseOdunDate(dateM[1], timeM?.[1]) : null) ?? new Date(Date.now() + 7 * 86400_000);
        const venue = venueM?.[1]?.trim() || "Odunpazarı";

        // Liste görseli `/upload/pages/thumb/...` veriyor. TAM afiş `/notchange/` yolunda
        // (og:image). Bu sitede `/large/` YOK → public API'nin genel "thumb→large" yükseltmesi
        // 404 üretiyordu. Doğrudan `/notchange/`'i sakla (içinde "thumb" geçmediği için API
        // dönüşümü tetiklenmez, görsel yüklenir).
        const img = (a.find("img").attr("src") ?? "").replace("/upload/pages/thumb/", "/upload/pages/notchange/");

        events.push({
          source: this.source,
          externalId,
          title,
          category: guessCategory(`${title} ${venue}`),
          venue,
          city: this.city,
          startsAt,
          isFree: true,
          imageUrl: img ? new URL(img, this.baseUrl).toString() : undefined,
          ticketUrl: new URL(href, this.baseUrl).toString(),
        });
      });

      return events.slice(0, 60);
    } catch (err) {
      console.warn("[OdunpazariScraper] fetch hatası:", err instanceof Error ? err.message : err);
      return [];
    }
  }
}
