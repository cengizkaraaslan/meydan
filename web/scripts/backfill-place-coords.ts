/**
 * OSM yerlerin lat/lng + fee'sini TEK Türkiye-geneli Overpass sorgusuyla doldurur
 * (81 ayrı sorgu rate-limit yiyordu). externalId = "osm-<type>-<id>" ile DB satırlarına eşler.
 *   npx tsx scripts/backfill-place-coords.ts            → kuru
 *   npx tsx scripts/backfill-place-coords.ts --write     → DB güncelle (.env.dbpush)
 */
import fs from "node:fs";
try {
  const txt = fs.readFileSync(".env.dbpush", "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} catch { /* env */ }

const WRITE = process.argv.includes("--write");
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const Q = '[out:json][timeout:240];area["ISO3166-1"="TR"]["admin_level"="2"]->.tr;nwr["tourism"="museum"](area.tr);out center tags;';

interface El { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
function feeOf(t: Record<string, string>): string | null {
  const f = (t.fee || "").toLowerCase();
  if (["yes", "paid", "ücretli"].includes(f)) return "PAID";
  if (["no", "free", "ücretsiz", "donation"].includes(f)) return "FREE";
  return null;
}

async function overpass(): Promise<El[]> {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(ENDPOINTS[i % ENDPOINTS.length], {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(Q), signal: AbortSignal.timeout(240_000),
      });
      if (!res.ok) { await new Promise((r) => setTimeout(r, 3000 * (i + 1))); continue; }
      const j = (await res.json()) as { elements?: El[] };
      return j.elements ?? [];
    } catch { await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
  }
  return [];
}

async function main() {
  const els = await overpass();
  console.log(`Overpass: ${els.length} müze`);
  const map = new Map<string, { lat: number | null; lng: number | null; fee: string | null }>();
  for (const el of els) {
    const lat = el.lat ?? el.center?.lat ?? null;
    const lng = el.lon ?? el.center?.lon ?? null;
    map.set(`osm-${el.type}-${el.id}`, { lat, lng, fee: feeOf(el.tags ?? {}) });
  }

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const rows = await db.place.findMany({ where: { source: "OSM" }, select: { id: true, externalId: true, lat: true } });
  console.log(`DB OSM yer: ${rows.length}`);
  let withCoord = 0, updated = 0;
  for (const r of rows) {
    const hit = map.get(r.externalId);
    if (!hit) continue;
    if (hit.lat != null) withCoord++;
    if (WRITE) {
      await db.place.update({
        where: { id: r.id },
        data: { ...(hit.lat != null ? { lat: hit.lat } : {}), ...(hit.lng != null ? { lng: hit.lng } : {}), ...(hit.fee ? { fee: hit.fee } : {}) },
      });
      updated++;
    }
  }
  console.log(`Eşleşen koordinatlı: ${withCoord} · güncellenen: ${updated}. ${WRITE ? "DB yazıldı." : "(KURU)"}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
