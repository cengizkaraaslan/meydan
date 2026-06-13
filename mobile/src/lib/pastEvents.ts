/**
 * Biten (tarihi geçmiş) etkinlikler + her etkinliğe ait paylaşım bilgisi.
 *
 * Veri kaynakları:
 *  - Etkinlikler: EtkinlikScout public API `/api/v1/events` (fetchEvents, `to`=şimdi).
 *    `to` her zaman doğru filtrelemediği için client'ta da starts_at < now süzülür.
 *  - Paylaşım sayısı/önizleme:
 *      • Yorum + katılımcı: `/api/v1/event-social?eventSlug=...` (gerçek DB; TTL yok →
 *        geçmiş etkinlikte de durur). { attendeeCount, comments[] } döner.
 *      • Foto/story önizlemesi: kullanıcının bu etkinliğe lokal paylaştığı story'ler
 *        (AsyncStorage `meydanfest:stories`, eventSlug eşleşen) — küçük resim olarak.
 *
 * Sayı 0 ise ilgili rakam/etiket HİÇ gösterilmez (component tarafında kontrol).
 */
import { API_BASE, fetchEvents, type ApiEvent } from "./api";
import { getStories, type Story } from "./stories";

const API_KEY = "meydanfest-app";

export interface RsvpCounts {
  going: number;
  maybe: number;
  interested: number;
}
export interface EventSocial {
  attendeeCount: number;
  commentCount: number;
  storyCount: number;
  rsvp: RsvpCounts;
}

const EMPTY_RSVP: RsvpCounts = { going: 0, maybe: 0, interested: 0 };

/** Bir etkinliğin gerçek sosyal sayıları (DB). Hata olursa sıfırlı döner. */
export async function fetchEventSocial(eventSlug: string): Promise<EventSocial> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/event-social?eventSlug=${encodeURIComponent(eventSlug)}`,
      { headers: { "x-api-key": API_KEY, Accept: "application/json" } },
    );
    if (!res.ok) return { attendeeCount: 0, commentCount: 0, storyCount: 0, rsvp: { ...EMPTY_RSVP } };
    const json = (await res.json()) as {
      data?: { attendeeCount?: number; comments?: unknown[]; commentCount?: number; storyCount?: number; rsvp?: Partial<RsvpCounts> };
    };
    const r = json.data?.rsvp;
    return {
      attendeeCount: json.data?.attendeeCount ?? 0,
      commentCount: json.data?.commentCount ?? json.data?.comments?.length ?? 0,
      storyCount: json.data?.storyCount ?? 0,
      rsvp: {
        going: r?.going ?? 0,
        maybe: r?.maybe ?? 0,
        interested: r?.interested ?? 0,
      },
    };
  } catch {
    return { attendeeCount: 0, commentCount: 0, storyCount: 0, rsvp: { ...EMPTY_RSVP } };
  }
}

/** Geçmiş etkinlik + paylaşım özeti (rozet/önizleme için). */
export interface PastEvent {
  event: ApiEvent;
  /** Bu etkinliğe lokal paylaşılan story foto uri'leri (önizleme için, yeni→eski). */
  photoUris: string[];
  /** Toplam paylaşım sayısı = lokal story + yorum (0 ise hiç gösterme). */
  shareCount: number;
  /** Katılımcı sayısı (0 ise hiç gösterme). */
  attendeeCount: number;
}

/**
 * Aktif şehre göre biten etkinlikleri, en yeni biten en üstte olacak şekilde getirir.
 * Her etkinlik için paylaşım sayısı + foto önizlemesini doldurur.
 */
export async function fetchPastEvents(opts: {
  city?: string;
  limit?: number;
}): Promise<PastEvent[]> {
  const nowIso = new Date().toISOString();
  const limit = opts.limit ?? 12;

  let raw: ApiEvent[] = [];
  try {
    const res = await fetchEvents({
      city: opts.city,
      to: nowIso,
      pageSize: 50,
    });
    raw = res.data ?? [];
  } catch {
    return [];
  }

  const now = Date.now();
  const past = raw
    .filter((e) => {
      const t = new Date(e.starts_at).getTime();
      return !Number.isNaN(t) && t < now;
    })
    // En yeni biten en üstte (starts_at azalan).
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    .slice(0, limit);

  if (past.length === 0) return [];

  // Lokal story'ler — tek okuma, slug bazlı grupla.
  let localStories: Story[] = [];
  try {
    localStories = await getStories();
  } catch {
    localStories = [];
  }
  const storiesBySlug = new Map<string, Story[]>();
  for (const s of localStories) {
    if (!s.eventSlug) continue;
    const list = storiesBySlug.get(s.eventSlug) ?? [];
    list.push(s);
    storiesBySlug.set(s.eventSlug, list);
  }

  // Sosyal sayıları paralel çek.
  const socials = await Promise.all(past.map((e) => fetchEventSocial(e.slug)));

  return past.map((event, i) => {
    const mine = storiesBySlug.get(event.slug) ?? [];
    const photoUris = mine
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .map((s) => s.uri)
      .filter(Boolean);
    const social = socials[i];
    const shareCount = photoUris.length + social.commentCount;
    return {
      event,
      photoUris,
      shareCount,
      attendeeCount: social.attendeeCount,
    };
  });
}
