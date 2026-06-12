import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import { guessCategory, detectTurkishCity } from "../parse-helpers";
import type { EventCategory, EventSource, ScrapedEvent } from "../../types";

/**
 * İKSV (İstanbul Kültür Sanat Vakfı) — müzik/caz/film/tiyatro festivalleri, Salon İKSV,
 * Bienal, Tasarım Bienali, Alt Kat. Tümü tek JSON ucundan gelir:
 *   POST /plugins/iksv/plugins.ashx  (plugin=events, form-urlencoded)
 * Bilet linki (programs[].ticketUrl) varsa biletli, yoksa ücretsiz kabul edilir.
 */

interface IksvProgram {
  ticketUrl?: string;
  time?: string;
  city?: string;
}
interface IksvFile {
  type?: number;
  file?: string;
}
interface IksvItem {
  articleId?: number;
  headline?: string;
  date?: string; // "12 Haziran 2026"
  dateFormatted?: string; // "/Date(1781283600000)/"
  place?: string;
  zone?: string; // festival adı
  category?: string; // "Müzik" | "Caz" | "Film" | "Tiyatro" | "Tasarım" ...
  alias?: string; // protokolsüz detay linki
  files?: IksvFile[];
  programs?: IksvProgram[];
}

function iksvCategory(cat: string | undefined, text: string): EventCategory {
  const c = (cat ?? "").toLocaleLowerCase("tr");
  if (/(müzik|muzik|caz|salon|konser)/.test(c)) return "KONSER";
  if (c.includes("tiyatro")) return "TIYATRO";
  if (/(tasarım|tasarim|bienal|sergi)/.test(c)) return "SERGI";
  if (c.includes("film")) return "DIGER";
  return guessCategory(`${text} ${cat ?? ""}`);
}

export class IksvScraper extends BaseScraper {
  public readonly source: EventSource = "IKSV";
  public readonly displayName = "İKSV – İstanbul Kültür Sanat Vakfı";
  public readonly baseUrl = "https://www.iksv.org";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    const body = new URLSearchParams({
      plugin: "events",
      programMusic: "734", programFilm: "1187", programCaz: "3142", programTiyatro: "9194",
      programSalon: "4582", programBienal: "4153", programAltkat: "11640", programTasarim: "8585",
      zone_id: "63,64", itemCount: "100", currentPage: "0", lang: "tr",
      month: "", category: "", year: "", day: "",
    });
    const res = await fetch(`${this.baseUrl}/plugins/iksv/plugins.ashx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: `${this.baseUrl}/tr/etkinlikler/etkinlikler`,
      },
      body: body.toString(),
      signal: opts.abortSignal ?? AbortSignal.timeout(this.defaultTimeoutMs),
    });
    if (!res.ok) throw new Error(`${this.source} responded ${res.status}`);
    const json = (await res.json()) as { data?: IksvItem[] };
    const items = json.data ?? [];
    const now = Date.now();
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (const it of items) {
      const title = (it.headline ?? "").trim();
      if (!title || !it.articleId) continue;

      const ms = it.dateFormatted?.match(/\/Date\((\d+)\)\//)?.[1];
      const startsAt = ms ? new Date(Number(ms)) : null;
      if (!startsAt || isNaN(startsAt.getTime()) || startsAt.getTime() < now - 86_400_000) continue;

      const externalId = `iksv-${it.articleId}`;
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      const prog = (it.programs ?? []).find((p) => p.ticketUrl?.trim());
      const ticketUrl = prog?.ticketUrl?.trim();
      const place = it.place?.trim() || "İstanbul";
      const city = detectTurkishCity(`${place} ${it.zone ?? ""}`) ?? "İstanbul";

      const img = (it.files ?? []).find((f) => f.type === 15)?.file;
      const imageUrl = img ? `${this.baseUrl}/i/content/${it.articleId}_${img}` : undefined;

      const detail = it.alias ? `https://${it.alias.replace(/^https?:\/\//, "")}` : `${this.baseUrl}/tr/etkinlikler/etkinlikler`;

      events.push({
        source: this.source,
        externalId,
        title,
        category: iksvCategory(it.category, title),
        venue: place,
        city,
        startsAt,
        isFree: !ticketUrl,
        ticketUrl: ticketUrl || detail,
        imageUrl,
        organizer: it.zone?.trim() || "İKSV",
      });
    }

    return events.slice(0, 80);
  }
}
