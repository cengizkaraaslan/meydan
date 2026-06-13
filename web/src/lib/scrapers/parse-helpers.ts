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
  // Dini/manevi sinyal ÖNCELİKLİ: "İlahi Konseri", "Sema Gösterisi", "Tasavvuf Müziği"
  // gibi başlıklar KONSER/TIYATRO'ya kapılmasın diye en başta değerlendirilir. Yalnız
  // güçlü/özgül dini tokenler — genel "müzik/konser" buraya düşmez.
  if (/(vaaz|hutbe|tasavvuf|tefsir|hadis\b|siyer|i̇lahi|ilahi|naat|kaside|mevlid|mevlit|mevlüt|kandil|regaip|mira[cç]|berat gecesi|kadir gecesi|kur['’]?an|hatim|mukabele|teravih|sahur|iftar|ramazan|namaz|manevi|maneviyat|irşad|irsad|zikir|semazen|sema göster|sema goster|sufi|hafızlık|hafizlik|icazet|i̇slami|islami|i̇slam araştırma|islam araştırma|diyanet|müftülük|muftuluk)/.test(t)) return "DINI";
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

/** Metinde geçen ilk Türk ili (şehir alanı olmayan kaynaklarda başlık/özetten çıkarmak için). */
const TR_CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Konya", "Gaziantep", "Eskişehir", "Mersin",
  "Trabzon", "Diyarbakır", "Samsun", "Kayseri", "Adana", "Şanlıurfa", "Kocaeli", "Sakarya", "Malatya",
  "Erzurum", "Van", "Sivas", "Yozgat", "Mardin", "Şırnak", "Rize", "Ordu", "Tokat", "Çorum", "Bolu",
  "Edirne", "Çanakkale", "Balıkesir", "Manisa", "Aydın", "Muğla", "Denizli", "Isparta", "Kütahya",
  "Tekirdağ", "Hatay", "Kahramanmaraş", "Elazığ", "Erzincan", "Düzce", "Zonguldak", "Karabük", "Aksaray",
];
export function detectTurkishCity(text: string): string | null {
  for (const c of TR_CITIES) if (text.includes(c)) return c;
  return null;
}

/**
 * Başlık gerçek etkinlik değil, idari/kurumsal duyuru mu? (üniversite/belediye "duyurular"
 * sayfaları elektrik kesintisi, ihale, sınav sonucu, alım ilanı gibi gürültüyle dolu —
 * bunlar etkinlik feed'ine GİRMEMELİ). Önce net etkinlik sinyali varsa asla duyuru sayma.
 */
export function isAdminNotice(title: string): boolean {
  const t = title.toLocaleLowerCase("tr");
  // Net etkinlik sinyali → kesinlikle duyuru değil (öncelikli koruma).
  if (
    /(konser|festival|şenlik|senlik|sergi|söyleşi|soylesi|panel|konferans|sempozyum|çalıştay|calistay|atölye|atolye|workshop|tiyatro|gösteri|gosteri|dinleti|resital|film göster|film goster|stand[\s-]?up|imza günü|imza gunu|yarışma|yarisma|turnuva|bienal|fuar|söyleşi|gala|kermes|defile)/.test(
      t,
    )
  ) {
    return false;
  }
  // İdari/kurumsal duyuru kalıpları → etkinlik değil, ele.
  return /(elektrik kesinti|su kesinti|doğal\s?gaz|dogal\s?gaz|\bkesinti|ihale|satın al|satin al|satış ilan|satis ilan|kiralama|alım ilan|alim ilan|alımı yapıla|alimi yapila|personel al|öğretim (üyesi|elemanı) al|ogretim (uyesi|elemani) al|sözleşmeli|sozlesmeli|\bkadro\b|yedek aday|\batama\b|görevlendir|gorevlendir|sınav sonu|sinav sonu|başvuru sonu|basvuru sonu|mülakat|mulakat|yerleştir|yerlestir|yönetmelik|yonetmelik|yönerge|yonerge|genelge|meclis günde|meclis gunde|encümen|encumen|imar plan|askı ilan|aski ilan|askıya çık|askiya cik|zeyilname|burs başvuru|burs basvuru|kayıt yenile|kayit yenile|ders kayd|bütünleme|butunleme|final sınav|vize sınav|akademik takvim|harç|yatay geçiş|yatay gecis|mazeret sınav|tebliğ|yeterlik sınav|yeterlik sinav|mezuniyet tören|mezuniyet toren|ilanen|duyurusu$|sonuçları$|sonuclari$|ilanı$|ilani$)/.test(
    t,
  );
}

/**
 * Başlık NET bir etkinlik mi? (konser/sergi/söyleşi/panel/atölye/tiyatro/şenlik...).
 * Üniversite "duyurular" sayfaları gibi sinyal/gürültü oranı kötü kaynaklarda DENYLIST
 * yetmez (idari ilan çeşidi sonsuz) → sadece bu allowlist'i geçenler etkinlik sayılır.
 */
export function isEventTitle(title: string): boolean {
  const t = title.toLocaleLowerCase("tr");
  return /(konser|festival|şenlik|senlik|sergi|söyleşi|soylesi|panel|konferans|seminer|sempozyum|çalıştay|calistay|atölye|atolye|workshop|tiyatro|gösteri̇m|gosterim|gösteri|gosteri|dinleti|resital|stand[\s-]?up|komedi|yarışma|yarisma|turnuva|şampiyona|sampiyona|maraton|koşusu|kosusu|\bgala\b|bienal|\bfuar|kermes|defile|imza gün|buluşma|bulusma|kutlama|\banma\b|anması|gecesi|şöleni|soleni|karnaval|etkinli[kğ]|\bforum\b|kariyer gün|\boyunu\b)/.test(
    t,
  );
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
