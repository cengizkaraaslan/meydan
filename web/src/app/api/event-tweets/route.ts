import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Etkinlikle ilgili son tweet'leri X (Twitter) API v2'den çeker.
 * X_BEARER_TOKEN env değişkeni TANIMLIYSA canlı tweet döner; YOKSA available:false +
 * "X'te ara" linki döner (ücretsiz fallback). Böylece anahtar eklenince otomatik
 * canlı tweet'e geçer, eklenmezse uygulama yine de kullanıcıyı X aramasına yönlendirir.
 *
 * Anahtar nasıl eklenir: Vercel env'e X_BEARER_TOKEN = <X API v2 Bearer Token> ekle.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ available: false, tweets: [], searchUrl: null });

  const searchUrl = `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({ available: false, reason: "no_token", tweets: [], searchUrl });
  }

  try {
    const query = `"${q}" -is:retweet`;
    const url = new URL("https://api.twitter.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "10");
    url.searchParams.set("tweet.fields", "created_at,public_metrics,lang");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username,profile_image_url,verified");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
      // X rate-limit'ini korumak için sonucu 15 dk önbellekle
      next: { revalidate: 900 },
    });

    if (!res.ok) {
      return NextResponse.json({ available: false, reason: `x_api_${res.status}`, tweets: [], searchUrl });
    }

    const data = await res.json();
    const users: Record<string, { name: string; username: string; profile_image_url?: string }> = {};
    for (const u of data.includes?.users ?? []) users[u.id] = u;

    const tweets = (data.data ?? []).map((t: Record<string, unknown>) => {
      const author = users[t.author_id as string];
      return {
        id: t.id,
        text: t.text,
        createdAt: t.created_at,
        likes: (t.public_metrics as Record<string, number> | undefined)?.like_count ?? 0,
        authorName: author?.name ?? "",
        authorHandle: author?.username ?? "",
        authorAvatar: author?.profile_image_url ?? null,
        url: author ? `https://x.com/${author.username}/status/${t.id}` : `https://x.com/i/status/${t.id}`,
      };
    });

    return NextResponse.json({ available: true, tweets, searchUrl });
  } catch {
    return NextResponse.json({ available: false, reason: "fetch_error", tweets: [], searchUrl });
  }
}
