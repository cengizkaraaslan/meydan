import * as cheerio from "cheerio";
import { decodeEntities } from "../parse-helpers";
import type { PlaceType, ScrapedPlace } from "../../types";

/**
 * Kültür ve Turizm Bakanlığı resmi müze portalı — muze.gov.tr.
 * Bakanlığa bağlı (MüzeKart) müzeler + örenyerleri, TÜM Türkiye (81 il).
 *
 * Event modeline UYMAZ (müzeler kalıcı, startsAt yok) → BaseScraper'dan TÜREMEZ;
 * kendi `ScrapedPlace[]` döndüren bağımsız toplayıcı. SSR HTML, JS gerekmez.
 *
 * Enumerasyon (NETLEŞTİ):
 *   1. GET /muzeler → gizli `__RequestVerificationToken` + il <select> (provinceId=plaka 1..81).
 *   2. Her provinceId için POST /Museums/GetSections {token, provinceId, sections:""}
 *      → müze kartları: href `muze-detay?SectionId=XX&DistId=YY` + ad. İl döngüden KESİN.
 *   3. (bütçe varsa) GET /muze-detay?SectionId&DistId → og:title (TR ad), og:image, og:description,
 *      "Adres:", "Saati: HH:MM" (açılış/kapanış).
 * TR içerik için /Language/Index/TR cookie'si alınır (yoksa İngilizce gelir).
 */

const BASE = "https://muze.gov.tr";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export interface MuzeScraperOptions {
  /** Mutlak süre bütçesi (ms). Detay çekimi bu ana kadar devam eder; dolunca kalanlar liste-only. */
  budgetMs?: number;
  /** Detay sayfası çekilsin mi (saat/görsel/adres). false → sadece liste (ad+il+detayUrl). */
  fetchDetails?: boolean;
  /** Detay fetch eşzamanlılığı. */
  detailConcurrency?: number;
  abortSignal?: AbortSignal;
}

export interface MuzeRunResult {
  source: "MUZE_GOV";
  startedAt: Date;
  finishedAt: Date;
  places: ScrapedPlace[];
  success: boolean;
  errorMessage?: string;
}

function guessType(name: string): PlaceType {
  const n = name.toLocaleLowerCase("tr");
  if (/(saray|köşk|kosk|kasr)/.test(n)) return "SARAY";
  if (/(örenyeri|ören yeri|oren|antik|ören|harabe|tümülüs|tumulus|höyük|hoyuk|tiyatro)/.test(n))
    return "OREN_YERI";
  return "MUZE";
}

export class MuzeScraper {
  public readonly source = "MUZE_GOV" as const;
  public readonly displayName = "Müzeler (Kültür Bakanlığı)";
  public readonly baseUrl = BASE;

  private async fetchText(
    url: string,
    init: RequestInit & { signal?: AbortSignal } = {},
  ): Promise<{ text: string; setCookie: string | null }> {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": UA,
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml,application/json",
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return { text: await res.text(), setCookie: res.headers.get("set-cookie") };
  }

  /** TR diline çevirip cookie alır. (302 redirect döner → res.ok kontrolü yapma.) */
  private async establishSession(signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${BASE}/Language/Index/TR?url=%2Fmuzeler`, {
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" },
      redirect: "manual",
      signal: signal ?? AbortSignal.timeout(20_000),
    });
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) return "";
    return setCookie
      .split(/,(?=[^;]+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
  }

  /** İki cookie string'ini (segment bazında) birleştirir. */
  private mergeCookies(a: string, setCookie: string | null): string {
    const out = new Map<string, string>();
    for (const part of a.split(";")) {
      const [k, ...v] = part.split("=");
      if (k.trim()) out.set(k.trim(), v.join("="));
    }
    if (setCookie) {
      for (const c of setCookie.split(/,(?=[^;]+=)/)) {
        const seg = c.split(";")[0].trim();
        const [k, ...v] = seg.split("=");
        if (k.trim()) out.set(k.trim(), v.join("="));
      }
    }
    return [...out.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  /** /muzeler'den token + il haritası (provinceId -> il adı) + GÜNCELLENMİŞ cookie.
   *  ASP.NET anti-forgery: form token'ı buranın set-cookie'siyle (RequestVerificationToken
   *  cookie'si) BİRLİKTE gönderilmeli; aksi halde GetSections 400 döner. */
  private async fetchTokenAndProvinces(
    cookie: string,
    signal?: AbortSignal,
  ): Promise<{ token: string; provinces: Array<{ id: string; city: string }>; cookie: string }> {
    const { text, setCookie } = await this.fetchText(`${BASE}/muzeler`, {
      headers: cookie ? { Cookie: cookie } : {},
      signal,
    });
    const $ = cheerio.load(text);
    const token =
      $("input[name='__RequestVerificationToken']").first().attr("value") ?? "";
    const provinces: Array<{ id: string; city: string }> = [];
    $("#ProvinceId option").each((_, el) => {
      const id = $(el).attr("value")?.trim();
      const city = decodeEntities($(el).text().trim());
      if (id && /^\d+$/.test(id) && city) provinces.push({ id, city });
    });
    return { token, provinces, cookie: this.mergeCookies(cookie, setCookie) };
  }

  /** Bir il için müze kartlarını parse eder (ad + SectionId/DistId, il=döngüden kesin). */
  private async fetchProvinceSections(
    provinceId: string,
    city: string,
    token: string,
    cookie: string,
    signal?: AbortSignal,
  ): Promise<ScrapedPlace[]> {
    const { text } = await this.fetchText(`${BASE}/Museums/GetSections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: new URLSearchParams({
        __RequestVerificationToken: token,
        provinceId,
        sections: "",
      }).toString(),
      signal,
    });
    const $ = cheerio.load(text);
    const seen = new Map<string, ScrapedPlace>();
    $("a[href*='muze-detay']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const m = href.match(/SectionId=([A-Z0-9]+)&(?:amp;)?DistId=([A-Z0-9]+)/i);
      if (!m) return;
      const sectionId = m[1].toUpperCase();
      const distId = m[2].toUpperCase();
      const name = decodeEntities($(el).text().trim()).replace(/\s+/g, " ");
      // "More Info" / "Buy Ticket" gibi buton linklerini atla — gerçek ad uzun olur.
      if (!name || name.length < 3 || /more info|buy ticket|bilet/i.test(name)) {
        // ad yoksa yine de kaydı tut (detaydan og:title gelecek)
        if (!seen.has(sectionId))
          seen.set(sectionId, { source: this.source, externalId: sectionId, distId, name: "", type: "MUZE", city });
        return;
      }
      const existing = seen.get(sectionId);
      if (!existing || !existing.name) {
        seen.set(sectionId, {
          source: this.source,
          externalId: sectionId,
          distId,
          name,
          type: guessType(name),
          city,
        });
      }
    });
    return [...seen.values()];
  }

  /** Detay sayfasından saat/görsel/adres/açıklama ve TR adı (og:title) çeker. */
  private async enrichDetail(p: ScrapedPlace, cookie: string, signal?: AbortSignal): Promise<void> {
    const url = `${BASE}/muze-detay?SectionId=${p.externalId}&DistId=${p.distId ?? ""}`;
    const { text } = await this.fetchText(url, {
      headers: cookie ? { Cookie: cookie } : {},
      signal,
    });
    const $ = cheerio.load(text);
    const og = (prop: string) =>
      $(`meta[property='og:${prop}']`).attr("content")?.trim() || undefined;

    const ogTitle = decodeEntities(og("title") ?? "").replace(/\s+/g, " ").trim();
    // Jenerik fallback sayfası ("Müze, örenyeri, antik tiyatro") → adı override etme.
    if (ogTitle && !/^(müze, örenyeri|museums?|museum)/i.test(ogTitle)) {
      p.name = ogTitle;
      p.type = guessType(ogTitle);
    }
    const desc = decodeEntities(og("description") ?? "").trim();
    if (desc && !/300'den fazla müze/i.test(desc)) p.description = desc;
    const img = og("image");
    // Jenerik kapak görselini (cover_about-us / img/) alma; yalnız gerçek müze fotoğrafı (/s3/).
    if (img && /\/s3\//.test(img)) p.imageUrl = img;

    const bodyText = $("body").text().replace(/\s+/g, " ");
    const am = bodyText.match(/Adres\s*:?\s*([^|]{5,160}?)(?:Ziyaret|Telefon|Tel\b|Saat|E-?mail|$)/i);
    if (am) p.address = am[1].trim().replace(/[\s,;]+$/, "");

    const times = [...text.matchAll(/Saati?\s*:?\s*([0-9]{1,2})[:.]([0-9]{2})/gi)].map(
      (m) => `${m[1].padStart(2, "0")}:${m[2]}`,
    );
    if (times[0]) p.openTime = times[0];
    if (times.length > 1) p.closeTime = times[times.length - 1];
  }

  public async run(opts: MuzeScraperOptions = {}): Promise<MuzeRunResult> {
    const startedAt = new Date();
    const fetchDetails = opts.fetchDetails ?? true;
    const detailConcurrency = Math.max(1, opts.detailConcurrency ?? 6);
    const deadlineTs = opts.budgetMs ? startedAt.getTime() + opts.budgetMs : undefined;
    const signal = opts.abortSignal;
    try {
      const langCookie = await this.establishSession(signal);
      const { token, provinces, cookie } = await this.fetchTokenAndProvinces(langCookie, signal);
      if (!token || provinces.length === 0) {
        throw new Error(`token/il bulunamadı (token:${token ? "var" : "yok"}, il:${provinces.length})`);
      }

      // 1) İlleri sınırlı eşzamanlı tara (DB/host'u boğmadan).
      const byId = new Map<string, ScrapedPlace>();
      await this.pool(
        provinces.map((pr) => async () => {
          if (deadlineTs && Date.now() >= deadlineTs) return;
          try {
            const list = await this.fetchProvinceSections(pr.id, pr.city, token, cookie, signal);
            for (const place of list) if (!byId.has(place.externalId)) byId.set(place.externalId, place);
          } catch (err) {
            console.warn(`[Muze] il ${pr.city} (${pr.id}) hatası:`, err instanceof Error ? err.message : err);
          }
        }),
        6,
        deadlineTs,
      );

      const places = [...byId.values()];

      // 2) Detayları bütçe içinde zenginleştir (kalanlar liste-only kalır; sonraki run tamamlar).
      if (fetchDetails) {
        await this.pool(
          places.map((p) => async () => {
            if (deadlineTs && Date.now() >= deadlineTs) return;
            try {
              await this.enrichDetail(p, cookie, signal);
            } catch (err) {
              console.warn(`[Muze] detay ${p.externalId} hatası:`, err instanceof Error ? err.message : err);
            }
          }),
          detailConcurrency,
          deadlineTs,
        );
      }

      // Adı boş kalanları (detay alınamadı + kart adı yoktu) ele.
      const finalPlaces = places.filter((p) => p.name && p.name.length >= 2);
      return { source: this.source, startedAt, finishedAt: new Date(), places: finalPlaces, success: true };
    } catch (err) {
      return {
        source: this.source,
        startedAt,
        finishedAt: new Date(),
        places: [],
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Sınırlı eşzamanlı görev havuzu (runAndPersist.runPool deseni). */
  private async pool(tasks: Array<() => Promise<void>>, concurrency: number, deadlineTs?: number): Promise<void> {
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (true) {
        if (deadlineTs && Date.now() >= deadlineTs) return;
        const i = next++;
        if (i >= tasks.length) return;
        await tasks[i]();
      }
    });
    await Promise.all(workers);
  }
}
