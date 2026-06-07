import "server-only";

/**
 * Instagram hashtag → son gönderiler.
 *
 * Instagram herkese açık hashtag verisini OTURUMSUZ vermiyor (login duvarı / 401
 * require_login). Bu yüzden bir oturum çerezi (`IG_SESSIONID`) şart. Çerez bir
 * burner hesaptan alınır (tarayıcı DevTools → Application → Cookies → sessionid).
 * Resmî olmayan web private API kullanılır — kırılgan olabilir; ban riski oturum
 * sahibi hesaptadır. Üretimde Graph API (Business) ya da Apify daha sağlamdır.
 */

export interface IgPost {
  shortcode: string;
  caption: string;
  imageUrl: string;
  takenAt: Date | null;
  permalink: string;
}

const APP_ID = "936619743392459";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

interface IgMedia {
  code?: string;
  caption?: { text?: string } | null;
  image_versions2?: { candidates?: { url?: string }[] };
  taken_at?: number;
}

function parseWebInfo(json: unknown): IgPost[] {
  const out: IgPost[] = [];
  const seen = new Set<string>();
  const data = (json as { data?: Record<string, unknown> })?.data ?? {};
  // recent + top kovalarının her ikisini de tara (recent öncelik).
  const buckets = [data.recent, data.top].filter(Boolean) as {
    sections?: { layout_content?: { medias?: unknown[]; fill_items?: unknown[] } }[];
  }[];
  for (const bucket of buckets) {
    for (const section of bucket.sections ?? []) {
      const medias =
        section?.layout_content?.medias ?? section?.layout_content?.fill_items ?? [];
      for (const m of medias) {
        const media: IgMedia = (m as { media?: IgMedia })?.media ?? (m as IgMedia);
        const code = media?.code;
        if (!code || seen.has(code)) continue;
        const imageUrl = media?.image_versions2?.candidates?.[0]?.url;
        if (!imageUrl) continue;
        seen.add(code);
        out.push({
          shortcode: code,
          caption: media?.caption?.text ?? "",
          imageUrl,
          takenAt: media?.taken_at ? new Date(media.taken_at * 1000) : null,
          permalink: `https://www.instagram.com/p/${code}/`,
        });
      }
    }
  }
  return out;
}

export async function fetchHashtagPosts(
  tag: string,
  opts: { sessionid?: string; limit?: number } = {},
): Promise<IgPost[]> {
  const sessionid = opts.sessionid ?? process.env.IG_SESSIONID ?? "";
  if (!sessionid) {
    throw new Error(
      "IG_SESSIONID yok — Instagram hashtag çekmek için bir oturum çerezi gerekli.",
    );
  }
  const cleanTag = tag.replace(/^#/, "").trim().toLowerCase();
  const url = `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${encodeURIComponent(cleanTag)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "x-ig-app-id": APP_ID,
      Accept: "*/*",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      Referer: `https://www.instagram.com/explore/tags/${encodeURIComponent(cleanTag)}/`,
      "X-Requested-With": "XMLHttpRequest",
      "X-IG-WWW-Claim": "0",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      Cookie: `sessionid=${sessionid}`,
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(
      `Instagram web_info "${cleanTag}" → ${res.status} (oturum dolmuş veya rate-limit olabilir)`,
    );
  }
  const json = await res.json();
  const posts = parseWebInfo(json);
  return opts.limit ? posts.slice(0, opts.limit) : posts;
}
