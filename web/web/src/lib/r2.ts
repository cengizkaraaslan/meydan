import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "etkinlik";

let _client: S3Client | null = null;

export function getR2(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
  return _client;
}

/** Folder prefix: production'da 'canli/', diğerlerinde (dev/preview) 'test/' */
export function uploadPrefix(): "test/" | "canli/" {
  return process.env.NODE_ENV === "production" ? "canli/" : "test/";
}

/**
 * R2 bucket'taki bir key için public URL üret.
 *
 * Sıralama:
 * 1. R2_PUBLIC_URL set ise → doğrudan public URL (en hızlı, CDN)
 * 2. NEXT_PUBLIC_APP_URL set ise → app domaini üzerinden proxy (absolute)
 * 3. Yoksa → relative proxy path (/api/r2-image/...) — http(s):// ile başlamaz
 *    ama addStory gibi server validatorlar için tam URL daha temiz olduğundan
 *    relative dönmek yerine production'da window.location yerine 'https://etkinlikscout.vercel.app' fallback'i kullanılır.
 */
export function publicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  // Stabil bir domain (NEXT_PUBLIC_SITE_URL) varsa mutlak; yoksa RELATIVE proxy path.
  // VERCEL_URL KULLANMA: deployment'a özel host Vercel koruması arkasında (401) →
  // <img> "Görsel yüklenemedi" veriyordu. Relative path origin-bağımsız: kullanıcı
  // hangi (stabil) domain'deyse görsel oradan yüklenir, her zaman çalışır.
  const stable = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (stable) return `${stable.replace(/\/+$/, "")}/api/r2-image/${key}`;
  return `/api/r2-image/${key}`;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}
