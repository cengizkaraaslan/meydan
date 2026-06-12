import { BaseScraper, type ScraperRunOptions } from "../BaseScraper";
import type { EventSource, ScrapedEvent } from "../../types";

/**
 * İSAM (İslam Araştırmaları Merkezi) — dini/ilmi konferans, sempozyum, seminer.
 * Site Next.js; DOM client-render → JSON-LD API kullanılır: /api/events (hydra:member).
 * Etkinlikler ücretsiz, İstanbul (Üsküdar). Kategori sabit DINI.
 */

interface IsamMember {
  id: number;
  eventDate?: string; // ISO
  translate?: {
    slogan?: string; // başlık
    slug?: string;
    header?: string; // mekan/açıklama (HTML)
    coverImage?: { fileFullUrl?: string };
  };
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class IsamScraper extends BaseScraper {
  public readonly source: EventSource = "ISAM";
  public readonly displayName = "İSAM – İslam Araştırmaları Merkezi";
  public readonly baseUrl = "https://www.isam.org.tr";

  protected async fetchListing(opts: ScraperRunOptions): Promise<ScrapedEvent[]> {
    const raw = await this.httpGet(`${this.baseUrl}/api/events?page=1`, opts.abortSignal, {
      headers: { Accept: "application/ld+json, application/json" },
    });
    const json = JSON.parse(raw) as { "hydra:member"?: IsamMember[] };
    const members = json["hydra:member"] ?? [];
    const now = Date.now();
    const events: ScrapedEvent[] = [];

    for (const m of members) {
      const title = (m.translate?.slogan ?? "").trim();
      if (!title || !m.eventDate) continue;
      const startsAt = new Date(m.eventDate);
      if (isNaN(startsAt.getTime())) continue;
      if (startsAt.getTime() < now - 86_400_000) continue; // geçmişi atla

      const desc = m.translate?.header ? stripHtml(m.translate.header) : undefined;
      const slug = m.translate?.slug;
      events.push({
        source: this.source,
        externalId: `isam-${m.id}`,
        title,
        description: desc?.slice(0, 600),
        category: "DINI",
        venue: "İSAM Konferans Salonu",
        city: "İstanbul",
        district: "Üsküdar",
        startsAt,
        isFree: true,
        ticketUrl: slug ? `${this.baseUrl}/etkinlikler/${slug}` : `${this.baseUrl}/tr/etkinlikler`,
        imageUrl: m.translate?.coverImage?.fileFullUrl,
        organizer: "İSAM",
      });
    }
    return events.slice(0, 60);
  }
}
