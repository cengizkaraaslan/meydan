import type { MunicipalityConfig } from "../GenericMunicipalityScraper";

/** Türkiye'deki tüm büyükşehir belediyeleri (30 il) */
export const MUNICIPALITY_CONFIGS: MunicipalityConfig[] = [
  // İstanbul/Ankara/İzmir/Eskişehir ayrı concrete class'larla zaten kayıtlı (IBB, ANKARA_BB, IZMIR_BB, ESKISEHIR_BB)
  // bursa.bel.tr/etkinlik — SSR HTML, .post-item kartları (col-lg-3), ul.list-inline içinde date+venue
  {
    source: "MUNI_BURSA",
    displayName: "Bursa BB",
    baseUrl: "https://www.bursa.bel.tr",
    eventListPath: "/etkinlik",
    city: "Bursa",
    selectors: {
      card: ".post-item",
      title: "h5 a",
      date: "ul.list-inline li:nth-of-type(2)",
      venue: "ul.list-inline li:nth-of-type(3)",
      image: "img",
      link: "a.stretched-link",
    },
  },
  // tepebasi.bel.tr/Etkinlikler — SSR HTML, .card.card-has-bg.click-col kartları;
  // .info ul li span'leri sırayla tarih ("15 Mayıs 2026 Cuma") / saat / mekan. (Eskişehir ilçe belediyesi)
  {
    source: "MUNI_TEPEBASI",
    displayName: "Tepebaşı Belediyesi",
    baseUrl: "https://www.tepebasi.bel.tr",
    eventListPath: "/Etkinlikler",
    city: "Eskişehir",
    selectors: {
      card: ".card.card-has-bg.click-col",
      title: "h4.card-title a",
      date: ".event-header .info ul li:first-child span",
      venue: ".event-header .info ul li:last-child span",
      image: "img.card-img",
      link: "h4.card-title a",
    },
  },
  // NOT: antalya.bel.tr/tr/etkinlikler — Vue.js v-for ile dinamik render, SSR'da event yok. Playwright/headless gerek.
  { source: "MUNI_ANTALYA",       displayName: "Antalya BB",        baseUrl: "https://www.antalya.bel.tr",          eventListPath: "/tr/etkinlikler",     city: "Antalya" },
  // MUNI_ADANA: Kasıtlı boş — etkinlik yayınlamıyor (sadece /tr/haberler).
  { source: "MUNI_ADANA",         displayName: "Adana BB",          baseUrl: "https://www.adana.bel.tr",            eventListPath: "/tr/etkinlik",     city: "Adana" },
  // konya.bel.tr/etkinlik — SSR HTML, .tiyatro-card kartları, h3 title, .card-footer .date
  {
    source: "MUNI_KONYA",
    displayName: "Konya BB",
    baseUrl: "https://www.konya.bel.tr",
    eventListPath: "/etkinlik",
    city: "Konya",
    selectors: {
      card: ".tiyatro-card",
      title: "h3",
      date: ".card-footer .date",
      venue: ".card-footer .tag",
      image: "img",
      link: "a",
    },
  },
  // NOT: gaziantep.bel.tr — Laravel/Filament tabanlı yeni site, /etkinlikler ve /tr/etkinlik* tümü 404.
  // Menüde sadece /tr/haberler ve /tr/ihaleler var, ayrı bir etkinlik bölümü yok. Playwright bile çözmez (sayfa yok).
  { source: "MUNI_GAZIANTEP",     displayName: "Gaziantep BB",      baseUrl: "https://www.gaziantep.bel.tr",        eventListPath: "/tr/etkinlikler",     city: "Gaziantep" },
  // Mersin: listede tarih/mekan YOK (tarih detay sayfasında) — startsAt fallback (+7g) kullanılır.
  {
    source: "MUNI_MERSIN", displayName: "Mersin BB", baseUrl: "https://www.mersin.bel.tr",
    eventListPath: "/etkinlikler", city: "Mersin",
    selectors: { card: ".card", title: ".card-title", date: "", venue: "", image: "img.card-img-top", link: "a[href]" },
  },
  // Kayseri: ASP.NET; tarih bitişik "19Mayıs2026" — parseDate boşluk-opsiyonel gevşetmesiyle yakalanıyor.
  {
    source: "MUNI_KAYSERI", displayName: "Kayseri BB", baseUrl: "https://www.kayseri.bel.tr",
    eventListPath: "/etkinlikler", city: "Kayseri",
    selectors: { card: ".event-item-box", title: ".event-item-title", date: ".event-item-date", venue: ".event-line:last-child .event-line-text", image: ".event-item-image img", link: ".event-item-title a" },
  },
  { source: "MUNI_DIYARBAKIR",    displayName: "Diyarbakır BB",     baseUrl: "https://www.diyarbakir.bel.tr",       eventListPath: "/etkinlikler",     city: "Diyarbakır" },
  // Hatay: api/events JSON, yanıt {success, data:[...]} ile sarmalı → listPath: "data".
  // date ISO "2026-05-13T16:30:00", url+image relative.
  {
    source: "MUNI_HATAY", displayName: "Hatay BB", baseUrl: "https://www.hatay.bel.tr",
    eventListPath: "/etkinlikler", city: "Hatay",
    api: { url: "/api/events", listPath: "data", fields: { id: "id", title: "name", date: "date", url: "url", image: "image" } },
  },
  { source: "MUNI_MANISA",        displayName: "Manisa BB",         baseUrl: "https://www.manisa.bel.tr",           eventListPath: "/etkinlikler",     city: "Manisa" },
  { source: "MUNI_SAMSUN",        displayName: "Samsun BB",         baseUrl: "https://www.samsun.bel.tr",           eventListPath: "/etkinlikler",     city: "Samsun" },
  { source: "MUNI_AYDIN",         displayName: "Aydın BB",          baseUrl: "https://www.aydin.bel.tr",            eventListPath: "/etkinlikler",     city: "Aydın" },
  { source: "MUNI_BALIKESIR",     displayName: "Balıkesir BB",      baseUrl: "https://www.balikesir.bel.tr",        eventListPath: "/etkinlikler",     city: "Balıkesir" },
  { source: "MUNI_DENIZLI",       displayName: "Denizli BB",        baseUrl: "https://www.denizli.bel.tr",          eventListPath: "/etkinlikler",     city: "Denizli" },
  { source: "MUNI_ERZURUM",       displayName: "Erzurum BB",        baseUrl: "https://www.erzurum.bel.tr",          eventListPath: "/etkinlikler",     city: "Erzurum" },
  { source: "MUNI_SANLIURFA",     displayName: "Şanlıurfa BB",      baseUrl: "https://www.sanliurfa.bel.tr",        eventListPath: "/etkinlikler",     city: "Şanlıurfa" },
  { source: "MUNI_SAKARYA",       displayName: "Sakarya BB",        baseUrl: "https://www.sakarya.bel.tr",          eventListPath: "/etkinlikler",     city: "Sakarya" },
  { source: "MUNI_TEKIRDAG",      displayName: "Tekirdağ BB",       baseUrl: "https://www.tekirdag.bel.tr",         eventListPath: "/etkinlikler",     city: "Tekirdağ" },
  // MUNI_TRABZON: ÇÖZMEZ — www.trabzon.bel.tr/etkinlikler sadece resim-carousel; gerçek veri kurumsal.trabzon.bel.tr/Etkinlikler alt-domeninde, ayrı concrete scraper gerek.
  { source: "MUNI_TRABZON",       displayName: "Trabzon BB",        baseUrl: "https://www.trabzon.bel.tr",          eventListPath: "/etkinlikler",     city: "Trabzon" },
  { source: "MUNI_VAN",           displayName: "Van BB",            baseUrl: "https://www.van.bel.tr",              eventListPath: "/etkinlikler",     city: "Van" },
  { source: "MUNI_KMARAS",        displayName: "Kahramanmaraş BB",  baseUrl: "https://www.kahramanmaras.bel.tr",    eventListPath: "/etkinlikler",     city: "Kahramanmaraş" },
  // MUNI_MALATYA: ÇÖZMEZ — /etkinlikler SSR'da etkinlik yok, JS ile dolduruluyor; headless gerek.
  { source: "MUNI_MALATYA",       displayName: "Malatya BB",        baseUrl: "https://www.malatya.bel.tr",          eventListPath: "/etkinlikler",     city: "Malatya" },
  { source: "MUNI_MARDIN",        displayName: "Mardin BB",         baseUrl: "https://www.mardin.bel.tr",           eventListPath: "/etkinlikler",     city: "Mardin" },
  { source: "MUNI_MUGLA",         displayName: "Muğla BB",          baseUrl: "https://www.mugla.bel.tr",            eventListPath: "/etkinlikler",     city: "Muğla" },
  // Ordu: temiz "5 Mayıs 2026" formatı. Liste geçmiş etkinlik de içerebilir.
  {
    source: "MUNI_ORDU", displayName: "Ordu BB", baseUrl: "https://www.ordu.bel.tr",
    eventListPath: "/etkinlikler", city: "Ordu",
    selectors: { card: ".activity-card", title: ".title", date: ".markers .marker-item li:nth-child(2) .text", venue: ".markers .marker-item .heading", image: ".activity-photo img", link: ".title a" },
  },
  // MUNI_KOCAELI: Endpoint yok — tüm /etkinlik* path'leri 404.
  { source: "MUNI_KOCAELI",       displayName: "Kocaeli BB",        baseUrl: "https://www.kocaeli.bel.tr",          eventListPath: "/etkinlikler",     city: "Kocaeli" },
];

/** İstanbul ilçe belediyeleri (popüler olanlar) */
export const ISTANBUL_DISTRICT_CONFIGS: MunicipalityConfig[] = [
  // Kadıköy: Etkinlikler ayrı subdomain'de (kultursanat.kadikoy.bel.tr), SSR. article.eleman kartları + h2 title + time + span.yer.
  {
    source: "MUNI_KADIKOY",
    displayName: "Kadıköy Bld",
    baseUrl: "https://kultursanat.kadikoy.bel.tr",
    eventListPath: "https://kultursanat.kadikoy.bel.tr/tr/kadikoyde-kultur-sanat",
    city: "İstanbul",
    selectors: {
      card: "article.eleman",
      title: "h2",
      date: "time",
      venue: "span.yer",
      image: "p.gorsel img",
      link: "a[href*='/kadikoyde-kultur-sanat/']",
    },
  },
  // NOT: besiktas.bel.tr Next.js SPA (besiktasplus.app API'sinden client-side fetch). HTML'de etkinlik yok + nginx 403 anti-bot.
  // Selector eklemenin anlamı yok; GenericMunicipalityScraper boş döner. Playwright + cookies gerek.
  { source: "MUNI_BESIKTAS", displayName: "Beşiktaş Bld", baseUrl: "https://besiktas.bel.tr", eventListPath: "/etkinlikler/", city: "İstanbul" },
  // Şişli: SSR sayfa ama #event-list AJAX-yüklü (şu an "Sonuç bulunamadı..." — planlı etkinlik yok). Yapı hazır olduğunda fallback selector'lar deniyor.
  {
    source: "MUNI_SISLI",
    displayName: "Şişli Bld",
    baseUrl: "https://www.sisli.bel.tr",
    eventListPath: "/etkinlikler",
    city: "İstanbul",
    selectors: {
      card: "#event-list > div, #event-list .event-card, .event-card",
      title: "h3, h4, .title",
      date: "time, .date",
      venue: ".venue, .location",
      image: "img",
      link: "a[href]",
    },
  },
  // MUNI_BEYOGLU: Kasıtlı boş — yapılandırılmış etkinlik listesi yok (sadece haber/duyuru slider).
  // (beyoglu.bel.tr WordPress, ayrı etkinlik post type'ı yok; /sanat/* kategori sayfaları AJAX-yüklü boş döner.)
  { source: "MUNI_BEYOGLU", displayName: "Beyoğlu Bld", baseUrl: "https://beyoglu.bel.tr", eventListPath: "/kategori/haberler/", city: "İstanbul" },
  // MUNI_USKUDAR: ÇÖZMEZ (generic ile) — ajandaDetay yanıtı '|||' ile 4 parçaya bölünüyor, etkinlikler part[3]'te (.media kartları) + aylık param gerek. Concrete scraper gerek.
  {
    source: "MUNI_USKUDAR",
    displayName: "Üsküdar Bld",
    baseUrl: "https://www.uskudar.bel.tr",
    eventListPath: "/tr/main/ajandaDetay?tarih=&kat=&siteID=1&sDil=tr&dilID=1&deger=&liste=1",
    city: "İstanbul",
    selectors: {
      card: "a.fc-day-grid-event",
      title: ".fc-title",
      date: "",
      venue: "",
      image: "img",
      link: "a.fc-day-grid-event",
    },
  },
];

/**
 * Etkinliği boş olan illere özel recon ile bulunan yerel kaynaklar (belediye).
 * Üniversite kaynakları configs/universities.ts içinde. KTB il müdürlükleri menü
 * gürültüsü riski yüksek olduğundan şimdilik eklenmedi; belediye/üniv yeterli.
 */
export const PROVINCIAL_MUNICIPALITY_CONFIGS: MunicipalityConfig[] = [
  // adiyaman.bel.tr/etkinlikler — SSR; her kart <a> içinde <h6> başlık + webdepo görseli
  {
    source: "MUNI_ADIYAMAN",
    displayName: "Adıyaman Belediyesi",
    baseUrl: "https://www.adiyaman.bel.tr",
    eventListPath: "/etkinlikler",
    city: "Adıyaman",
    selectors: { card: "a:has(h6)", title: "h6", image: "img", link: "a" },
  },
  // kirikkale.bel.tr/?sayfa=etkinlikler — klasik PHP, kart = <a href='?sayfa=etkinlik_detay&id=N'>
  // başlık+tarih+saat+yer anchor metninde (başlık fallback'i devreye girer), görsel Yuklemeler/Etkinlikler
  {
    source: "MUNI_KIRIKKALE",
    displayName: "Kırıkkale Belediyesi",
    baseUrl: "https://www.kirikkale.bel.tr",
    eventListPath: "/?sayfa=etkinlikler",
    city: "Kırıkkale",
    selectors: { card: "a[href*='etkinlik_detay']", image: "img", link: "a" },
  },
  // duzce.bel.tr/dizin/haberler — SSR; kart <a> içinde <h6> başlık (etkinlik duyuruları dahil)
  // NOT: /dizin/etkinlikler SSR ama içerik 2024'te kalmış (ölü), haberler güncel
  {
    source: "MUNI_DUZCE",
    displayName: "Düzce Belediyesi",
    baseUrl: "https://www.duzce.bel.tr",
    eventListPath: "/dizin/haberler",
    city: "Düzce",
    selectors: { card: "a:has(h6)", title: "h6", image: "img", link: "a" },
  },
  // Üniversiteleri Vercel'den erişilemeyen iller — belediye /haberler ile kapsanıyor.
  // Kart: başlıklı/görselli <a> (başlık yoksa anchor metni fallback). title h6 bulunmazsa fallback.
  // bolu.bel.tr/haberler çok seyrek; ibu.edu.tr Vercel'den erişilemiyor. Valilik etkinlik takvimi (gov.tr, erişilebilir).
  {
    source: "VALILIK_BOLU",
    displayName: "Bolu Valiliği",
    baseUrl: "https://bolu.gov.tr",
    eventListPath: "/etkinlik-takvimi",
    city: "Bolu",
    selectors: { card: "a:has(img), a:has(h6), a:has(h5)", title: "h6, h5", image: "img", link: "a" },
  },
  {
    source: "MUNI_KARS",
    displayName: "Kars Belediyesi",
    baseUrl: "https://www.kars.bel.tr",
    eventListPath: "/haberler",
    city: "Kars",
    selectors: { card: "a:has(h6), a:has(img)", title: "h6", image: "img", link: "a" },
  },
  // NOT: mus.bel.tr Vercel'den erişilemiyor (timeout). İl Kültür Müdürlüğü (gov.tr) kullanılıyor.
  {
    source: "KTB_MUS",
    displayName: "Muş İl Kültür ve Turizm Müdürlüğü",
    baseUrl: "https://mus.ktb.gov.tr",
    eventListPath: "/TR-187046/duyurular.html",
    city: "Muş",
    selectors: { card: "li:has(a[href^='/TR-'])", title: "a", image: "img", link: "a" },
  },
  {
    source: "MUNI_IGDIR",
    displayName: "Iğdır Belediyesi",
    baseUrl: "https://www.igdir.bel.tr",
    eventListPath: "/haberler",
    city: "Iğdır",
    selectors: { card: "a:has(h6), a:has(img)", title: "h6", image: "img", link: "a" },
  },
  // kilis.bel.tr — WordPress; duyuru/ilan listesi. Kart = tarihli permalink anchor (/index.php/YYYY/...)
  {
    source: "MUNI_KILIS",
    displayName: "Kilis Belediyesi",
    baseUrl: "https://www.kilis.bel.tr",
    eventListPath: "/index.php/category/ilan-ve-duyurular/",
    city: "Kilis",
    selectors: { card: "h3:has(a), h2:has(a), article, .post", title: "a, .entry-title", image: "img", link: "a" },
  },
];

export const ALL_MUNICIPALITY_CONFIGS = [
  ...MUNICIPALITY_CONFIGS,
  ...ISTANBUL_DISTRICT_CONFIGS,
  ...PROVINCIAL_MUNICIPALITY_CONFIGS,
];
