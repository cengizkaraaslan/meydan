import * as cheerio from "cheerio";
import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import { CITIES, type EventSource, type ScrapedEvent } from "../../types";
import { parseTurkishDate, guessCategory, decodeEntities } from "../parse-helpers";
import { slugify } from "../../utils";

/**
 * Gençlik ve Spor Bakanlığı — e-Genç / Genç Ofis Faaliyetleri.
 * https://e-genc.gsb.gov.tr/Faaliyet?kurumTipEnum=Faaliyet
 *
 * Liste AJAX'tan gelir: POST /Faaliyet/_PostGetirFaaliyetListe (x-www-form-urlencoded:
 * page, baslangic_tarihi, bitis_tarihi, il_id, ilce_id, faaliyet_ad) → JSON
 * {ProcessStatus, Result:"<ul class='offices_list'><li>...</li></ul>"}. Her kart yalnız
 * BAŞLIK + ŞEHİR + detay linkini taşır — TARİH YOK. Başlangıç/Bitiş tarihi ancak detay
 * sayfasında (/Faaliyet/FaaliyetDetay?faliyetId=...) bulunur, bu yüzden tarih (özellikle
 * istenen BİTİŞ tarihi) ve gerçek görsel için kart başına bir detay GET'i şart.
 *
 * Maliyet sınırı: kart başına 1 detay isteği → varsayılan ilk MAX_PAGES sayfa (12 kart/sayfa)
 * gezilir, opts.maxItems verilirse ona uyulur. Boş sayfa (0 kart) gelince durulur; aralık
 * dışı sayfa endpoint'ten boş liste döner.
 *
 * Genç Ofis faaliyetleri ücretsiz/halka açık gençlik etkinlikleri → isFree:true.
 * Kategori başlıktan tahmin edilir (kurs→ATOLYE, spor→SPOR, çocuk→COCUK ...).
 */

// Sayfa başına 12 faaliyet; her biri 1 (yavaş) detay GET'i ister. Hacim env'den
// ayarlanabilir (yeniden derleme/deploy gerekmeden): GSB_MAX_PAGES (varsayılan 20 ≈ 240
// faaliyet), GSB_DETAIL_CONCURRENCY (varsayılan 6). Sıralama en yeni→eski olduğundan
// ilk sayfalar yaklaşan faaliyetlerdir. NOT: cron'un ~50sn bütçesinde yüksek değer
// zaman aşımına düşebilir; asıl yüksek hacim manuel tam-tarama (run-all-persist) içindir.
const DEFAULT_MAX_PAGES = Number(process.env.GSB_MAX_PAGES) || 20;
const DETAIL_CONCURRENCY = Number(process.env.GSB_DETAIL_CONCURRENCY) || 6;
const PLACEHOLDER_IMG = "foto-cekiliyor"; // "foto çekiliyor" placeholder'ı → görsel sayma

/** "ERZİNCAN", "AĞRI", "istanbul" → CITIES listesindeki kanonik il adı. */
const CITY_BY_SLUG = new Map(CITIES.map((c) => [slugify(c), c]));
function resolveCity(raw: string): string {
  const cleaned = decodeEntities(raw).replace(/\s+/g, " ").trim();
  const canonical = CITY_BY_SLUG.get(slugify(cleaned));
  if (canonical) return canonical;
  // Listede yoksa baş harf büyük Türkçe başlık yap.
  return cleaned
    .toLocaleLowerCase("tr")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ");
}

interface CardStub {
  title: string;
  city: string;
  detailUrl: string;
  externalId: string;
}

export class GsbGencOfisScraper extends BaseScraper {
  public readonly source: EventSource = "GSB_GENC_OFIS";
  public readonly displayName = "GSB Genç Ofis Faaliyetleri";
  public readonly baseUrl = "https://e-genc.gsb.gov.tr";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    if (process.env.USE_MOCK_DATA === "true") return [];

    const limit = typeof opts.maxItems === "number" ? opts.maxItems : Infinity;
    const maxPages = Number.isFinite(limit) ? Math.ceil(limit / 12) + 1 : DEFAULT_MAX_PAGES;

    // 1) Listeyi sayfa sayfa topla (yalnız başlık/şehir/detay-linki).
    const stubs: CardStub[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= maxPages; page++) {
      let json: string;
      try {
        json = await this.httpPostForm(
          `${this.baseUrl}/Faaliyet/_PostGetirFaaliyetListe`,
          { page: String(page), baslangic_tarihi: "", bitis_tarihi: "", il_id: "", ilce_id: "", faaliyet_ad: "" },
          opts.abortSignal,
          { insecureTLS: true, headers: { Referer: `${this.baseUrl}/Faaliyet?kurumTipEnum=Faaliyet` } },
        );
      } catch (err) {
        console.warn(`[GsbGencOfisScraper] liste sayfa ${page} alınamadı:`, err instanceof Error ? err.message : err);
        break;
      }

      let html: string;
      try {
        const parsed = JSON.parse(json) as { ProcessStatus?: boolean; Result?: string };
        if (!parsed.ProcessStatus || !parsed.Result) break;
        html = parsed.Result;
      } catch {
        break; // beklenmedik gövde
      }

      const before = stubs.length;
      const $ = cheerio.load(html);
      $("ul.offices_list > li a").each((_, a) => {
        const href = $(a).attr("href") ?? "";
        const detailUrl = href ? new URL(href, this.baseUrl).toString() : "";
        const title = decodeEntities($(a).find(".offices_list_bottom_title").first().text()).replace(/\s+/g, " ").trim();
        const cityRaw = $(a).find(".offices_list_bottom_address").first().text();
        if (!detailUrl || !title) return;

        // externalId: faliyetId stabil ama URL-encoded → slug + son 8 alfanümerik karakter.
        let token = "";
        try {
          const id = new URL(detailUrl).searchParams.get("faliyetId") ?? "";
          token = id.replace(/[^A-Za-z0-9]/g, "").slice(-10);
        } catch { /* yoksay */ }
        const externalId = `${slugify(title).slice(0, 48)}-${token || slugify(title).slice(-6)}`;
        if (seen.has(externalId)) return;
        seen.add(externalId);

        stubs.push({ title, city: resolveCity(cityRaw), detailUrl, externalId });
      });

      if (stubs.length === before) break; // boş / tekrar sayfa → bitti
      if (stubs.length >= limit) break;
      await this.sleep(this.defaultDelayMs, opts.abortSignal);
    }

    const targets = Number.isFinite(limit) ? stubs.slice(0, limit) : stubs;
    if (stubs.length >= DEFAULT_MAX_PAGES * 12) {
      console.info(`[GsbGencOfisScraper] ${stubs.length} faaliyet bulundu (sayfa sınırı ${maxPages}); daha fazlası olabilir.`);
    }

    // 2) Her kart için detay sayfasından tarih/bitiş/görsel/düzenleyen çek. Cron run()'ı
    //    abortSignal vermeden mutlak süre bütçesiyle yarıştırdığından, sıralı 60 istek bütçeyi
    //    yer → aynı hosta SINIRLI eşzamanlılıkla (kibar) çekip wall-time'ı kısa tutuyoruz.
    const cutoff = Date.now() - 86_400_000; // bitmiş faaliyetleri (bitiş < dün) ele
    const events: ScrapedEvent[] = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const stub = targets[cursor++];
        let detailHtml: string;
        try {
          detailHtml = await this.httpGet(stub.detailUrl, opts.abortSignal, { insecureTLS: true });
        } catch (err) {
          console.warn(`[GsbGencOfisScraper] detay alınamadı (${stub.title}):`, err instanceof Error ? err.message : err);
          continue;
        }
        const event = this.parseDetail(detailHtml, stub);
        if (!event) continue;
        if ((event.endsAt ?? event.startsAt).getTime() < cutoff) continue; // bitmiş
        events.push(event);
      }
    };
    await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, targets.length) }, worker));

    return events;
  }

  /** Detay sayfasından bir ScrapedEvent kurar; tarih çözülemezse null. */
  private parseDetail(html: string, stub: CardStub): ScrapedEvent | null {
    const $ = cheerio.load(html);

    // list-group: her <li> bir <h6> etiket + <span.text-secondary> değer taşır.
    const fields: Record<string, string> = {};
    $("li.list-group-item").each((_, li) => {
      const label = $(li).find("h6").first().text().replace(/\s+/g, " ").trim().toLocaleLowerCase("tr");
      const value = decodeEntities($(li).find("span.text-secondary").first().text()).replace(/\s+/g, " ").trim();
      if (label) fields[label] = value;
    });

    const startsAt = parseTurkishDate(fields["başlangıç tarihi"] ?? "");
    if (!startsAt) return null; // tarihsiz → feed'e alma
    // Bitiş yalnız GERÇEK bir aralıksa (başlangıçtan sonra) anlamlı — tek günlük faaliyette
    // başlangıç=bitiş redundant "Bitiş" satırı doğurmasın (kod tabanı konvansiyonu).
    const parsedEnd = parseTurkishDate(fields["bitiş tarihi"] ?? "");
    const endsAt = parsedEnd && parsedEnd.getTime() > startsAt.getTime() ? parsedEnd : undefined;

    const title = decodeEntities($("h4").first().text()).replace(/\s+/g, " ").trim() || stub.title;
    const organizer = decodeEntities($("p.text-secondary.mb-1").first().text()).replace(/\s+/g, " ").trim() || undefined;
    // Şehir: liste kartının adres'i temiz il adı verir ("AĞRI"); detay "Adres" bazen mekan adı
    // ("Eleşkirt Gençlik Merkezi") → stub.city önceliklidir, yoksa detay adresine düş.
    const city = stub.city || (fields["adres"] ? resolveCity(fields["adres"]) : "");

    // Görsel: carousel'deki gerçek /Files/... görseli (placeholder'ı atla).
    let imageUrl: string | undefined;
    $("#carouselExampleControls img, .carousel-inner img").each((_, img) => {
      if (imageUrl) return;
      const src = $(img).attr("src") ?? "";
      if (src && !src.includes(PLACEHOLDER_IMG)) imageUrl = new URL(src, this.baseUrl).toString();
    });

    return {
      source: this.source,
      externalId: stub.externalId,
      title,
      category: guessCategory(title),
      venue: organizer || city,
      city,
      organizer,
      startsAt,
      endsAt,
      isFree: true, // Genç Ofis faaliyetleri ücretsiz/halka açık
      ticketUrl: stub.detailUrl,
      imageUrl,
    };
  }
}
