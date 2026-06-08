import type { MunicipalityConfig } from "../GenericMunicipalityScraper";

/**
 * Kültür merkezi / müze / sahne / topluluk / ücretsiz atölye kaynakları (özel recon, SSR doğrulandı).
 * JS-render veya 403 olanlar DAHİL EDİLMEDİ: CRR, Devlet Opera-Bale, Sakıp Sabancı, İstanbul Modern,
 * Arter, MEB e-Yaygın, BELMEK, Eventbrite/Kommunity/Meetup (özel UA/JSON parse gerektirir).
 * Generic scraper başlık fallback'i (kart <a> ise kendi metni) bu kaynakların çoğunu kapsar.
 */
export const VENUE_CONFIGS: MunicipalityConfig[] = [
  // ── Müze & sergiler (İstanbul) ──
  {
    source: "PERA",
    displayName: "Pera Müzesi",
    baseUrl: "https://www.peramuzesi.org.tr",
    eventListPath: "/sergi",
    city: "İstanbul",
    selectors: { card: "a[href*='/sergi/']", title: ".card-title", image: "img.card-img-top", link: "a" },
  },
  {
    source: "SADBERK",
    displayName: "Sadberk Hanım Müzesi",
    baseUrl: "https://www.sadberkhanimmuzesi.org.tr",
    eventListPath: "/tr/sergiler",
    city: "İstanbul",
    selectors: { card: ".exhibition_item", image: "img", link: "a[href^='/tr/sergiler/']" },
  },
  {
    source: "SALT",
    displayName: "SALT",
    baseUrl: "https://saltonline.org",
    eventListPath: "/tr/tag/17/sergiler",
    city: "İstanbul",
    selectors: { card: ".menu-center-item, .wrap-page-items a[href^='/tr/']", image: "img", link: "a[href^='/tr/']" },
  },
  // ── Ücretsiz atölye / kültür (İstanbul) ──
  // kultur.istanbul WP Event Manager — sadece ÜCRETSİZ filtreli URL, tarihli kartlar
  {
    source: "KULTUR_IST",
    displayName: "Kültür İstanbul (Ücretsiz)",
    baseUrl: "https://kultur.istanbul",
    eventListPath: "/event_listing_type/ucretsiz/",
    city: "İstanbul",
    selectors: {
      card: ".event_listing",
      title: ".wpem-event-title .wpem-heading-text",
      date: ".wpem-event-date-time-text",
      image: ".wpem-event-banner-img",
      link: "a.wpem-event-action-url",
    },
  },
  // ── Sahne — Devlet Tiyatroları (Türkiye geneli; bölge id → şehir) ──
  // Kart = oyundetay anchor'ı; başlık anchor metni (fallback). Her bölge ayrı source →
  // aynı turne oyunu farklı şehirde meşru ayrı kayıt (dedup ${source}-${externalId}).
  // Bölge id→şehir eşlemesi devtiyatro.gov.tr'nin /genelprogramlar/<id> (ve /bolgeler/<id>,
  // /iletisim/<id>) indekslenmiş sayfa başlıklarından çıkarıldı (tahmin yok).
  {
    source: "DT_ANKARA",
    displayName: "Devlet Tiyatroları (Ankara)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/1",
    city: "Ankara",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_ISTANBUL",
    displayName: "Devlet Tiyatroları (İstanbul)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/2",
    city: "İstanbul",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_IZMIR",
    displayName: "Devlet Tiyatroları (İzmir)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/3",
    city: "İzmir",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_BURSA",
    displayName: "Devlet Tiyatroları (Bursa)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/4",
    city: "Bursa",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_ADANA",
    displayName: "Devlet Tiyatroları (Adana)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/5",
    city: "Adana",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_TRABZON",
    displayName: "Devlet Tiyatroları (Trabzon)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/6",
    city: "Trabzon",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_DIYARBAKIR",
    displayName: "Devlet Tiyatroları (Diyarbakır)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/7",
    city: "Diyarbakır",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_ANTALYA",
    displayName: "Devlet Tiyatroları (Antalya)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/8",
    city: "Antalya",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_ERZURUM",
    displayName: "Devlet Tiyatroları (Erzurum)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/9",
    city: "Erzurum",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_KONYA",
    displayName: "Devlet Tiyatroları (Konya)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/10",
    city: "Konya",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_SIVAS",
    displayName: "Devlet Tiyatroları (Sivas)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/11",
    city: "Sivas",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_VAN",
    displayName: "Devlet Tiyatroları (Van)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/12",
    city: "Van",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_GAZIANTEP",
    displayName: "Devlet Tiyatroları (Gaziantep)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/13",
    city: "Gaziantep",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_ELAZIG",
    displayName: "Devlet Tiyatroları (Elazığ)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/15",
    city: "Elazığ",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_SAMSUN",
    displayName: "Devlet Tiyatroları (Samsun)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/17",
    city: "Samsun",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_KAYSERI",
    displayName: "Devlet Tiyatroları (Kayseri)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/27",
    city: "Kayseri",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  // ── Topluluk & tech (çoğu ücretsiz; Türkiye geneli/İstanbul) ──
  {
    source: "CODERSPACE",
    displayName: "Coderspace",
    baseUrl: "https://coderspace.io",
    eventListPath: "/etkinlikler/meet-up/",
    city: "İstanbul",
    selectors: { card: ".event-card", image: "img", link: "a[href^='/etkinlikler/']" },
  },
];
