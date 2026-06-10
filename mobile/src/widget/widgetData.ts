import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Widget (headless) için hafif etkinlik çekme — uygulama API'sinden bağımsız,
 * minimum bağımlılık. Kullanıcının (varsa) şehrine göre yaklaşan ilk etkinliği döner.
 */
const API_BASE = "https://etkinlikscout.vercel.app";
const API_KEY = "meydanfest-app";

// Son başarılı etkinlik burada saklanır → widget eklenince/güncellenince ANINDA
// (ağ beklemeden) gösterilir; arkadan taze veri gelince tazelenir.
const CACHE_KEY = "meydanfest:widget:lastEvent";

export interface WidgetEvent {
  title: string;
  venue: string;
  city: string;
  startsAt: string;
  isFree: boolean;
  category: string;
  /** Etkileşim sayıları — uygulama detay ekranıyla aynı deterministik formülle üretilir. */
  going: number;
  maybe: number;
  interested: number;
  comments: number;
}

/** Etkinlik id'sinden deterministik sayı (attending.ts hashEventId ile AYNI). */
function hashEventId(eventId: string): number {
  let h = 2166136261;
  for (let i = 0; i < eventId.length; i++) {
    h ^= eventId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Bir kategori için katılımcı sayısı — attending.ts mockAttendeesFor ile AYNI sayıyı verir
 * (baseCounts + seed%3): going 5–7, maybe 4–6, interested 3–5. Böylece widget ile detay
 * ekranındaki rakamlar tutarlı olur.
 */
function catCount(eventId: string, cat: "going" | "maybe" | "interested"): number {
  const base = hashEventId(eventId);
  const catOffset = cat === "going" ? 0 : cat === "maybe" ? 1 : 2;
  const seed = base + catOffset * 101;
  const baseCounts = cat === "going" ? 5 : cat === "maybe" ? 4 : 3;
  return baseCounts + (seed % 3);
}

/** AsyncStorage headless'ta bazen erişilemez — şehir okuma fetch'i ASLA engellememeli. */
async function readCity(): Promise<string> {
  try {
    return (
      (await AsyncStorage.getItem("meydanfest:city")) ||
      (await AsyncStorage.getItem("meydanfest:detectedCity")) ||
      ""
    );
  } catch {
    return "";
  }
}

async function fetchList(params: Record<string, string>): Promise<Array<Record<string, unknown>>> {
  const sp = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}/api/v1/events?${sp.toString()}`, {
    headers: { "x-api-key": API_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return Array.isArray(json?.data) ? json.data : [];
}

/** Son saklanan etkinliği oku (anında ilk çizim için; ağ beklemez). Yoksa/erişilemezse null. */
export async function loadCachedWidgetEvent(): Promise<WidgetEvent | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as WidgetEvent) : null;
  } catch {
    return null;
  }
}

export async function loadWidgetEvent(): Promise<WidgetEvent | null> {
  const city = await readCity();
  const now = new Date().toISOString();
  // 1) Şehir + yaklaşan → 2) yalnız yaklaşan → 3) filtresiz (her halükârda bir şey göster).
  const attempts: Array<Record<string, string>> = [];
  if (city) attempts.push({ city, from: now, page_size: "12" });
  attempts.push({ from: now, page_size: "12" });
  attempts.push({ page_size: "12" });

  for (const params of attempts) {
    try {
      const list = await fetchList(params);
      const ev = list.find((e) => typeof e?.title === "string" && (e.title as string).trim());
      if (ev) {
        const eid = String(ev.id ?? ev.slug ?? ev.title ?? "");
        // Yorum sayısı: varsa gerçek (comment_count), yoksa id'den deterministik (3–24).
        const realComments = Number(ev.comment_count);
        const comments = Number.isFinite(realComments) && realComments > 0 ? realComments : 3 + (hashEventId(eid + "c") % 22);
        const result: WidgetEvent = {
          title: String(ev.title ?? ""),
          venue: String(ev.venue ?? ""),
          city: String(ev.city ?? ""),
          startsAt: String(ev.starts_at ?? ""),
          isFree: Boolean(ev.is_free),
          category: String(ev.category ?? ""),
          going: catCount(eid, "going"),
          maybe: catCount(eid, "maybe"),
          interested: catCount(eid, "interested"),
          comments,
        };
        // Sonraki açılış/eklemede anında göstermek için sakla (best-effort).
        try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch { /* yoksay */ }
        return result;
      }
    } catch (e) {
      console.warn("[widget] etkinlik çekilemedi:", String(e));
    }
  }
  return null;
}
