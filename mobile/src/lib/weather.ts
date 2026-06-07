/**
 * MeydanFest — hava durumu (Open-Meteo, ANAHTARSIZ).
 * Şehir adından geocode → o günün günlük tahmini. Open-Meteo forecast yalnızca
 * ~16 gün ileriyi verir; daha ileri tarih veya hata → null (UI göstermez).
 */

export interface DayWeather {
  tempMax: number;
  tempMin: number;
  code: number;
  emoji: string;
  label: string;
}

/** WMO weather_code → emoji + kısa TR label. */
function describe(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Güneşli" };
  if (code >= 1 && code <= 3) return { emoji: "⛅", label: "Parçalı bulutlu" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Sisli" };
  if (code >= 51 && code <= 67) return { emoji: "🌧️", label: "Yağmurlu" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", label: "Karlı" };
  if (code >= 80 && code <= 82) return { emoji: "🌦️", label: "Sağanak" };
  if (code >= 95 && code <= 99) return { emoji: "⛈️", label: "Fırtınalı" };
  return { emoji: "⛅", label: "Parçalı bulutlu" };
}

export async function getEventWeather(city: string, dateISO: string): Promise<DayWeather | null> {
  try {
    const name = (city ?? "").trim();
    if (!name) return null;

    // dateISO → YYYY-MM-DD
    const d = new Date(dateISO);
    if (isNaN(d.getTime())) return null;
    const ymd = d.toISOString().slice(0, 10);

    // 1) Geocode
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=tr`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return null;
    const geo = await geoRes.json();
    const place = geo?.results?.[0];
    if (!place || typeof place.latitude !== "number" || typeof place.longitude !== "number") return null;

    // 2) Forecast (tek gün)
    const fcUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${ymd}&end_date=${ymd}`;
    const fcRes = await fetch(fcUrl);
    if (!fcRes.ok) return null;
    const fc = await fcRes.json();

    const daily = fc?.daily;
    const code = daily?.weather_code?.[0];
    const max = daily?.temperature_2m_max?.[0];
    const min = daily?.temperature_2m_min?.[0];
    // Tarih aralık dışıysa (örn. 16 günden ileri) Open-Meteo değer döndürmez.
    if (typeof code !== "number" || typeof max !== "number" || typeof min !== "number") return null;

    const { emoji, label } = describe(code);
    return {
      tempMax: Math.round(max),
      tempMin: Math.round(min),
      code,
      emoji,
      label,
    };
  } catch {
    return null;
  }
}
