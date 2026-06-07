import * as cheerio from "cheerio";
import { unstable_cache } from "next/cache";

/** Açıklama kesik mi? ("[...]", "…", sonda "...", "devamı") */
export function isTruncated(desc?: string | null): boolean {
  if (!desc) return true; // hiç yoksa da zenginleştirmeyi dene
  return /\[\s*[.…]+\s*\]|…|\.\.\.\s*$|devam(ı|ını)/i.test(desc.trim());
}

function clean(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

/** Detay HTML'inden mümkün olan en dolu açıklamayı çıkar. */
function extractDescription(html: string): string | null {
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  // 1) JSON-LD description
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of arr) {
        if (it && typeof it === "object" && typeof it.description === "string") {
          candidates.push(clean(it.description));
        }
      }
    } catch {
      /* bozuk JSON */
    }
  });

  // 2) İçerik kapsayıcısındaki paragrafları birleştir
  const containers = [
    "article", "main", ".icerik", ".content", ".detay", ".haber-detay",
    ".event-detail", ".aciklama", "[class*='detail']", "[class*='icerik']", "[class*='content']",
  ];
  for (const sel of containers) {
    const node = $(sel).first();
    if (!node.length) continue;
    const ps = node
      .find("p")
      .map((_, el) => clean($(el).text()))
      .get()
      .filter((t) => t.length > 30 && !/çerez|cookie|telif|copyright|tüm hakları/i.test(t));
    const joined = ps.join("\n\n").trim();
    if (joined.length > 120) {
      candidates.push(joined);
      break;
    }
  }

  // 3) og:description / meta description
  const og =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    "";
  if (og) candidates.push(clean(og));

  // En dolu, kesik OLMAYAN adayı seç (yoksa en uzunu)
  const full = candidates.filter((c) => c.length > 60 && !isTruncated(c)).sort((a, b) => b.length - a.length)[0];
  const best = full ?? candidates.sort((a, b) => b.length - a.length)[0];
  return best && best.length > 60 ? best.slice(0, 4000) : null;
}

/** URL'den tam açıklamayı çek (24s önbellekli; URL başına bir kez). */
export const getFullDescription = unstable_cache(
  async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      return extractDescription(await res.text());
    } catch {
      return null;
    }
  },
  ["full-event-description"],
  { revalidate: 86400 },
);
