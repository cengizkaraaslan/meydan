import "server-only";
import { fetchHashtagPosts, type IgPost } from "./fetchHashtag";
import { extractEventFromImage, type ExtractedEvent } from "../ai/extractEvent";
import type { ScrapedEvent } from "../types";

/**
 * Instagram hashtag'lerinden etkinlik adayları üretir:
 *   hashtag → son gönderiler → her afişi Claude vision ile oku → ScrapedEvent.
 *
 * NOT: IG CDN görsel URL'leri imzalı ve saatler içinde EXPIRE olur. Kalıcı kullanım
 * için imageUrl'i R2'ye yeniden barındırmak gerekir (upload/presign altyapısı mevcut).
 * Bu fonksiyon ham IG URL'ini döndürür; çağıran isterse re-host eder.
 */

export interface IgCandidate {
  post: IgPost;
  extracted: ExtractedEvent;
  event: ScrapedEvent;
}

export interface ScrapeHashtagsResult {
  candidates: IgCandidate[];
  stats: { tagsTried: number; postsSeen: number; eventsFound: number; errors: string[] };
}

function toScrapedEvent(post: IgPost, ex: ExtractedEvent): ScrapedEvent {
  const startsAt = ex.startsAtISO ? new Date(ex.startsAtISO) : null;
  const validDate = startsAt && !isNaN(startsAt.getTime()) ? startsAt : new Date(Date.now() + 7 * 86400_000);
  const desc = [ex.description, `Kaynak: Instagram — ${post.permalink}`]
    .filter(Boolean)
    .join(" • ");
  return {
    source: "INSTAGRAM",
    externalId: `instagram-${post.shortcode}`,
    title: ex.title || post.caption.slice(0, 80) || "İsimsiz etkinlik",
    description: desc.slice(0, 400),
    category: ex.category,
    venue: ex.venue || "Instagram",
    city: ex.city || "",
    startsAt: validDate,
    isFree: ex.isFree,
    ticketUrl: ex.ticketUrl ?? post.permalink,
    imageUrl: post.imageUrl,
  };
}

export async function scrapeHashtagEvents(
  tags: string[],
  opts: { sessionid?: string; minConfidence?: number; perTagLimit?: number } = {},
): Promise<ScrapeHashtagsResult> {
  const minConfidence = opts.minConfidence ?? 0.6;
  const candidates: IgCandidate[] = [];
  const errors: string[] = [];
  const seenShortcodes = new Set<string>();
  let postsSeen = 0;

  for (const tag of tags) {
    let posts: IgPost[];
    try {
      posts = await fetchHashtagPosts(tag, { sessionid: opts.sessionid, limit: opts.perTagLimit ?? 24 });
    } catch (err) {
      errors.push(`${tag}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const post of posts) {
      if (seenShortcodes.has(post.shortcode)) continue;
      seenShortcodes.add(post.shortcode);
      postsSeen++;
      const extracted = await extractEventFromImage(post.imageUrl, post.caption);
      if (!extracted || !extracted.isEvent || extracted.confidence < minConfidence) continue;
      candidates.push({ post, extracted, event: toScrapedEvent(post, extracted) });
    }
  }

  return {
    candidates,
    stats: { tagsTried: tags.length, postsSeen, eventsFound: candidates.length, errors },
  };
}
