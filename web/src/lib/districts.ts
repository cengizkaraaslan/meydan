import "server-only";
import { FESTIVALL_EVENTS } from "./festivall-events";
import { MOCK_EVENTS } from "./mock-data";
import { TURKEY_DISTRICTS } from "./turkey-districts";

/**
 * Şehirler içinde tespit edilmiş ilçeler.
 * Build-time'da etkinlik datasından dinamik olarak çıkarılır.
 */
function buildIndex(): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const e of [...FESTIVALL_EVENTS, ...MOCK_EVENTS]) {
    if (!e.district) continue;
    if (!e.city) continue;
    const key = e.city;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(e.district);
  }
  const out: Record<string, string[]> = {};
  for (const [city, set] of map) {
    out[city] = [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }
  return out;
}

const _INDEX = buildIndex();

/**
 * Bir il içindeki TÜM resmi ilçeleri (turkiyeapi.dev) + etkinlik verisinden çıkan
 * ekstra ilçeleri alfabetik, tekilleştirilmiş döndürür. Etkinlik olmasa da tüm
 * ilçeler seçilebilsin diye resmi liste taban alınır.
 */
export function getDistrictsForCity(city: string): string[] {
  const official = TURKEY_DISTRICTS[city] ?? [];
  const dynamic = _INDEX[city] ?? [];
  const set = new Set<string>([...official, ...dynamic]);
  return [...set].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Tüm ilçe haritasını döndürür (debug/admin için) */
export function getAllDistricts(): Record<string, string[]> {
  return _INDEX;
}
