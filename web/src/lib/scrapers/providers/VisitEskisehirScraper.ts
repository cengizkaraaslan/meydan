import * as cheerio from "cheerio";
import { MunicipalityScraper } from "../MunicipalityScraper";
import type { EventCategory, EventSource, ScrapedEvent } from "../../types";

const ESKISEHIR_MOCK: ScrapedEvent[] = [
  {
    source: "ESKISEHIR_BB",
    externalId: "es-fallback-1",
    title: "Eskişehir Belediyesi Etkinliği (offline mock)",
    category: "ATOLYE",
    venue: "Belirlenecek",
    city: "Eskişehir",
    startsAt: new Date(Date.now() + 7 * 86400_000),
    isFree: true,
    ticketUrl: "https://www.visiteskisehir.org/kategori.php?id=73",
  },
];

function parseTurkishDmy(text: string): Date | null {
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})(?:[^\d]*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "20", mi = "0"] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
}

function guessCategory(text: string): EventCategory {
  const t = text.toLowerCase();
  if (/(konser|resital|müzik|muzik|festival|caz|jazz)/.test(t)) return "KONSER";
  if (/(tiyatro|oyun|sahne)/.test(t)) return "TIYATRO";
  if (/(stand[\s-]?up|komedi)/.test(t)) return "STANDUP";
  if (/(spor|maç|koşu|kosu|turnuva|yürüyüş|yuruyus|bisiklet)/.test(t)) return "SPOR";
  if (/(sergi|exhibition|müze|muze|galeri)/.test(t)) return "SERGI";
  if (/(atölye|atolye|workshop|kurs|seminer)/.test(t)) return "ATOLYE";
  if (/(çocuk|cocuk|kids|junior)/.test(t)) return "COCUK";
  if (/festival/.test(t)) return "FESTIVAL";
  return "DIGER";
}

export class VisitEskisehirScraper extends MunicipalityScraper {
  public readonly source: EventSource = "ESKISEHIR_BB";
  public readonly displayName = "Eskişehir BB (Visit Eskişehir)";
  public readonly baseUrl = "https://www.visiteskisehir.org";
  private readonly listingUrl = "https://www.visiteskisehir.org/kategori.php?id=73";

  protected async fetchListing(): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") {
      return ESKISEHIR_MOCK;
    }

    try {
      const html = await this.httpGet(this.listingUrl);
      const $ = cheerio.load(html);

      const seen = new Set<string>();
      const events: ScrapedEvent[] = [];

      $('h4 a[href*="sayfa-detay.php"]').each((_, anchor) => {
        const $a = $(anchor);
        const title = $a.text().trim().replace(/\s+/g, " ");
        const href = $a.attr("href") ?? "";
        const idMatch = href.match(/id=(\d+)/);
        if (!title || !idMatch) return;
        const externalId = `es-${idMatch[1]}`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        const $h4 = $a.closest("h4");
        const container = $h4.parent().length ? $h4.parent() : $h4;
        const containerText = container.text();

        const startsAt = parseTurkishDmy(containerText) ?? new Date(Date.now() + 7 * 86400_000);

        let imageUrl = container.find("img[src]").first().attr("src") ?? "";
        if (!imageUrl) {
          // Bazen img kart linkindedir (h4'ten farklı container)
          const $imageAnchor = $(`a[href="${href}"]`).filter((_, el) => $(el).find("img").length > 0).first();
          imageUrl = $imageAnchor.find("img").attr("src") ?? "";
        }
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = new URL(imageUrl, this.baseUrl).toString();
        }

        let venue = "";
        const venueMatch = containerText.match(/(?:Yer|Mekan|Konum)\s*[:\-]\s*([^\n]+)/i);
        if (venueMatch) venue = venueMatch[1].trim().slice(0, 100);

        // Açıklama: kart container'ında title harici ilk anlamlı p / .description / .ozet / .aciklama
        let description: string | undefined;
        const descSelectors = [".description", ".aciklama", ".ozet", ".excerpt", ".summary", "p"];
        for (const sel of descSelectors) {
          const raw = container.find(sel).first().text().trim().replace(/\s+/g, " ");
          if (raw && raw !== title && raw.length >= 20) {
            description = raw.slice(0, 400);
            break;
          }
        }

        events.push({
          source: this.source,
          externalId,
          title,
          description,
          category: guessCategory(title),
          venue: venue || "Eskişehir Büyükşehir Belediyesi",
          city: "Eskişehir",
          startsAt,
          isFree: true,
          imageUrl: imageUrl || undefined,
          ticketUrl: new URL(href, this.baseUrl).toString(),
        });
      });

      if (events.length === 0) {
        console.warn("[VisitEskisehirScraper] Hiç etkinlik bulunamadı, mock'a dönülüyor");
        return ESKISEHIR_MOCK;
      }
      return events;
    } catch (err) {
      console.warn("[VisitEskisehirScraper] fetch hatası, mock kullanılıyor:", err);
      return ESKISEHIR_MOCK;
    }
  }
}
