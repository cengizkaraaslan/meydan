/**
 * Kanonik site bilgileri — SEO (metadataBase, sitemap, robots, JSON-LD) için tek kaynak.
 *
 * URL çözümleme önceliği: NEXT_PUBLIC_SITE_URL > VERCEL_URL > localhost.
 * Sonda slash yok; tüketiciler `${siteUrl()}/path` kurabilir.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Marka adı — layout/metadata ile tutarlı. */
export const SITE_NAME = "MeydanFest";

/** Bir path'i mutlak URL'e çevirir (zaten mutlaksa olduğu gibi döner). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}
