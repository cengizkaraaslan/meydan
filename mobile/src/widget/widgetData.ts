import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Widget (headless) için hafif etkinlik çekme — uygulama API'sinden bağımsız,
 * minimum bağımlılık. Kullanıcının (varsa) şehrine göre yaklaşan ilk etkinliği döner.
 */
const API_BASE = "https://etkinlikscout.vercel.app";
const API_KEY = "meydanfest-app";

export interface WidgetEvent {
  title: string;
  venue: string;
  city: string;
  startsAt: string;
  isFree: boolean;
  category: string;
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
        return {
          title: String(ev.title ?? ""),
          venue: String(ev.venue ?? ""),
          city: String(ev.city ?? ""),
          startsAt: String(ev.starts_at ?? ""),
          isFree: Boolean(ev.is_free),
          category: String(ev.category ?? ""),
        };
      }
    } catch (e) {
      console.warn("[widget] etkinlik çekilemedi:", String(e));
    }
  }
  return null;
}
