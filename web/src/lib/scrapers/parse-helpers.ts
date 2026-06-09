import type { EventCategory } from "../types";

/**
 * Yeni concrete scraper'lar (Bugece, Zorlu PSM, Biletino, Şehir Tiyatroları, Songkick)
 * için ortak parse yardımcıları. IBBScraper / GenericMunicipalityScraper içindeki
 * tekrarlanan mantığın tek noktada toplanmış hali.
 */

const TR_MONTH: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4, haziran: 5,
  temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

/**
 * Türkçe / ISO / gg.aa.yyyy tarih metnini Date'e çevirir.
 * Opsiyonel `hhmm` ("19:00") verilirse saati ondan alır (kart ayrı saat alanı veriyorsa).
 * Yıl yoksa içinde bulunulan yıl varsayılır; tarih geçmişteyse bir sonraki yıla taşınır.
 */
export function parseTurkishDate(text: string, hhmm?: string): Date | null {
  const cleaned = text.trim().toLocaleLowerCase("tr");
  if (!cleaned) return null;

  let result: Date | null = null;

  const iso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, h = "20", min = "0"] = iso;
    result = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }

  if (!result) {
    const dmy = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[^\d]*(\d{1,2}):(\d{2}))?/);
    if (dmy) {
      const [, d, m, y, h = "20", min = "0"] = dmy;
      result = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
    }
  }

  if (!result) {
    const tr = cleaned.match(/(\d{1,2})\s+([a-zçğıöşü]+)(?:\s+(\d{4}))?(?:[^\d]*(\d{1,2})[:.](\d{2}))?/);
    if (tr) {
      const [, day, monthWord, year, hour = "20", minute = "0"] = tr;
      const month = TR_MONTH[monthWord];
      if (month != null) {
        const now = new Date();
        const y = year ? Number(year) : now.getFullYear();
        result = new Date(y, month, Number(day), Number(hour), Number(minute));
        // Yıl belirtilmemişse ve tarih ~1 günden fazla geçmişteyse gelecek yıla taşı
        if (!year && result.getTime() < now.getTime() - 86400_000) {
          result = new Date(y + 1, month, Number(day), Number(hour), Number(minute));
        }
      }
    }
  }

  if (result && hhmm) {
    const t = hhmm.match(/(\d{1,2})[:.](\d{2})/);
    if (t) result.setHours(Number(t[1]), Number(t[2]), 0, 0);
  }

  return result;
}

/** Başlık/mekan metninden kategori tahmini. */
export function guessCategory(text: string): EventCategory {
  const t = text.toLocaleLowerCase("tr");
  if (/(konser|resital|müzik|muzik|caz|jazz|orkestra|dj|techno|house|elektronik|rap|hip[\s-]?hop|sahne alıyor)/.test(t)) return "KONSER";
  if (/(festival|fest\b)/.test(t)) return "FESTIVAL";
  if (/(tiyatro|oyun|sahne|müzikal|muzikal|gösteri|gosteri)/.test(t)) return "TIYATRO";
  if (/(stand[\s-]?up|komedi|tek kişilik)/.test(t)) return "STANDUP";
  if (/(spor|maç|mac|koşu|kosu|turnuva|yürüyüş|yuruyus|bisiklet|atletizm|champions league|gp\b|motogp|formula)/.test(t)) return "SPOR";
  if (/(fuar|fair|expo|kongre|congress|summit|zirve)/.test(t)) return "FUAR";
  if (/(sergi|exhibition|müze|muze|galeri|bienal)/.test(t)) return "SERGI";
  if (/(atölye|atolye|workshop|kurs|seminer|eğitim|egitim|tasarım|tasarim)/.test(t)) return "ATOLYE";
  if (/(çocuk|cocuk|kids|junior|aile eğlencesi|aile eglencesi)/.test(t)) return "COCUK";
  return "DIGER";
}

const HTML_ENTITY_MAP: Record<string, string> = {
  "&#252;": "ü", "&#220;": "Ü", "&#246;": "ö", "&#214;": "Ö",
  "&#231;": "ç", "&#199;": "Ç", "&#287;": "ğ", "&#286;": "Ğ",
  "&#350;": "Ş", "&#351;": "ş", "&#304;": "İ", "&#305;": "ı",
  "&#x130;": "İ", "&#x131;": "ı", "&#x15e;": "Ş", "&#x15f;": "ş",
  "&#xd6;": "Ö", "&#xf6;": "ö", "&#xdc;": "Ü", "&#xfc;": "ü",
  "&#xc7;": "Ç", "&#xe7;": "ç", "&#x11e;": "Ğ", "&#x11f;": "ğ",
  "&amp;": "&", "&quot;": "\"", "&#39;": "'", "&nbsp;": " ",
};

/** Sayısal/hex HTML entity'leri çözer (Şehir Tiyatroları link metni gibi). */
export function decodeEntities(s: string): string {
  return s.replace(/&#?\w+;/gi, (m) => HTML_ENTITY_MAP[m.toLowerCase()] ?? HTML_ENTITY_MAP[m] ?? m);
}

/** Görece URL'yi mutlağa çevirir; boşsa undefined döner. */
export function absUrl(src: string | undefined, base: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http")) return src;
  try {
    return new URL(src, base).toString();
  } catch {
    return undefined;
  }
}

/** Slug'ı insan-okur başlığa çevirir ("ben-medea-degilim" → "Ben Medea Degilim"). */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
    .join(" ");
}
