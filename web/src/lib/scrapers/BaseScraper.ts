import type { EventSource, ScrapedEvent } from "../types";
import { slugify } from "../utils";

export interface ScraperResult {
  source: EventSource;
  startedAt: Date;
  finishedAt: Date;
  events: ScrapedEvent[];
  success: boolean;
  errorMessage?: string;
}

export interface ScraperRunOptions {
  maxItems?: number;
  abortSignal?: AbortSignal;
}

export abstract class BaseScraper {
  public abstract readonly source: EventSource;
  public abstract readonly displayName: string;
  public abstract readonly baseUrl: string;

  protected readonly userAgent =
    "Mozilla/5.0 (compatible; EtkinlikScoutBot/1.0; +https://etkinlikscout.example/about)";
  protected readonly defaultTimeoutMs = 15_000;
  protected readonly defaultDelayMs = 800;

  protected abstract fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]>;

  public async run(opts: ScraperRunOptions = {}): Promise<ScraperResult> {
    const startedAt = new Date();
    try {
      const raw = await this.fetchListing(opts);
      const events = raw.map((e) => this.normalize(e));
      const finishedAt = new Date();
      return { source: this.source, startedAt, finishedAt, events, success: true };
    } catch (err) {
      const finishedAt = new Date();
      return {
        source: this.source,
        startedAt,
        finishedAt,
        events: [],
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  protected normalize(e: ScrapedEvent): ScrapedEvent {
    const title = e.title.trim().replace(/\s+/g, " ");
    return {
      ...e,
      title,
      city: this.normalizeCity(e.city),
      venue: e.venue.trim(),
      isFree: e.isFree || (e.priceMin === 0 && e.priceMax === 0),
    };
  }

  protected normalizeCity(city: string): string {
    const map: Record<string, string> = {
      istanbul: "İstanbul", ankara: "Ankara", izmir: "İzmir", bursa: "Bursa",
      antalya: "Antalya", adana: "Adana", konya: "Konya", gaziantep: "Gaziantep",
      eskisehir: "Eskişehir", mersin: "Mersin", trabzon: "Trabzon",
      diyarbakir: "Diyarbakır", samsun: "Samsun", kayseri: "Kayseri",
    };
    const key = slugify(city.trim());
    return map[key] ?? city.trim();
  }

  protected buildSlug(title: string, externalId: string): string {
    return `${slugify(title)}-${externalId.slice(-6)}`;
  }

  protected async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = setTimeout(resolve, ms);
      if (signal) {
        if (signal.aborted) {
          clearTimeout(id);
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          clearTimeout(id);
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      }
    });
  }

  protected async httpGet(url: string, signal?: AbortSignal): Promise<string> {
    // Timeout şart: yavaş/asılı kalan site (örn. 180sn) tüm cron'u kilitlemesin.
    const res = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      signal: signal ?? AbortSignal.timeout(this.defaultTimeoutMs),
    });
    if (!res.ok) {
      throw new Error(`${this.source} ${url} responded ${res.status}`);
    }
    return res.text();
  }
}
