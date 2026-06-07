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
  // ── Sahne — Devlet Tiyatroları (bölge id ile şehir) ──
  // Kart = oyundetay anchor'ı; başlık anchor metni (fallback). id=1 Ankara, id=2 İstanbul.
  {
    source: "DT_ISTANBUL",
    displayName: "Devlet Tiyatroları (İstanbul)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/2",
    city: "İstanbul",
    selectors: { card: "a[href*='/oyundetay/']", image: "img", link: "a" },
  },
  {
    source: "DT_ANKARA",
    displayName: "Devlet Tiyatroları (Ankara)",
    baseUrl: "https://www.devtiyatro.gov.tr",
    eventListPath: "/DevletTiyatro/tr/genelprogramlar/1",
    city: "Ankara",
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
