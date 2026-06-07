import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/events";
import { siteUrl } from "@/lib/site";
import { CITIES } from "@/lib/types";

export const revalidate = 3600; // saatte bir yeniden üret

/** Herkese açık, indekslenmesini istediğimiz statik rotalar. */
const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/etkinlikler", priority: 0.9, changeFrequency: "hourly" },
  { path: "/sinema", priority: 0.8, changeFrequency: "daily" },
  { path: "/hafta-sonu", priority: 0.8, changeFrequency: "daily" },
  { path: "/yakinimda", priority: 0.6, changeFrequency: "daily" },
  { path: "/harita", priority: 0.6, changeFrequency: "weekly" },
  { path: "/takvim", priority: 0.6, changeFrequency: "daily" },
  { path: "/onerilen", priority: 0.6, changeFrequency: "daily" },
  { path: "/abonelik", priority: 0.5, changeFrequency: "monthly" },
  { path: "/api-docs", priority: 0.4, changeFrequency: "monthly" },
  { path: "/gizlilik", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // Şehir bazlı filtre sayfaları — uzun kuyruk SEO ("İstanbul etkinlikleri" vb.)
  const cityEntries: MetadataRoute.Sitemap = CITIES.map((city) => ({
    url: `${base}/etkinlikler?city=${encodeURIComponent(city)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  // Etkinlik detay sayfaları
  let eventEntries: MetadataRoute.Sitemap = [];
  try {
    const { events } = await getEvents({ pageSize: 5000 });
    eventEntries = events.map((e) => ({
      url: `${base}/etkinlik/${e.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    // Veri katmanı düşse bile sitemap statik+şehir girdileriyle dönebilmeli
    eventEntries = [];
  }

  return [...staticEntries, ...cityEntries, ...eventEntries];
}
