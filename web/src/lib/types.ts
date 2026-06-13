export type EventCategory =
  | "KONSER"
  | "FESTIVAL"
  | "TIYATRO"
  | "STANDUP"
  | "SPOR"
  | "SERGI"
  | "ATOLYE"
  | "COCUK"
  | "FUAR"
  | "DINI"
  | "DIGER";

/**
 * Bilinen kaynaklar string union'da, ama yeni kaynaklar config'ten gelir.
 * `(string & {})` trick: tüm string'leri kabul ederken IDE'de bilinen literal'leri korur.
 */
export type EventSource =
  | "BILETIX"
  | "BUBILET"
  | "MOBILET"
  | "PASSO"
  | "BILETINIAL"
  | "BUGECE"
  | "BILETINO"
  | "ZORLU_PSM"
  | "SEHIR_TIYATROLARI"
  | "SONGKICK"
  | "TICKETMASTER"
  | "IBB"
  | "ANKARA_BB"
  | "IZMIR_BB"
  | "ESKISEHIR_BB"
  | "ESKISEHIR_TREND"
  | "FESTTR"
  | "FESTIVALL_TR"
  | "GSB_GENC_OFIS"
  | "ANADOLU_UNI"
  | "BILKENT"
  | "ITU"
  | "BOGAZICI"
  | "MANUAL"
  | (string & {});

export type AttendanceStatus = "GOING" | "MAYBE" | "INTERESTED";

export type SubscriptionPlan = "FREE" | "PRO" | "BUSINESS";

export interface ScrapedEvent {
  source: EventSource;
  externalId: string;
  title: string;
  description?: string;
  category: EventCategory;
  venue: string;
  city: string;
  /** İngilizce ülke adı (Ticketmaster venue country.name, ör. "Turkey", "Spain"). Yurt dışı filtresi için. */
  country?: string;
  /** İl içinde ilçe (örn. "Kadıköy", "Çankaya") - opsiyonel. Filtre için kullanılır. */
  district?: string;
  /** Etkinliği düzenleyen kurum/kişi (üniv. adı, festival organizatörü, manuel etkinlikte oluşturan). Scraped'lerde çoğunlukla yok. */
  organizer?: string;
  /**
   * Düzenleyen bir KULLANICI ise profil kimliği (manuel/USER etkinlikte oluşturanın
   * creatorEmail/deviceId'si). Mobil "Düzenleyen" ismine tıklayınca /kisi/<id> profiline
   * gitmek için. Scraped (üniv./festival) etkinliklerde profil yok → boş. creatorHidden
   * (gizli) etkinliklerde organizer ile birlikte boş bırakılır.
   */
  organizerId?: string;
  startsAt: Date;
  endsAt?: Date;
  priceMin?: number;
  priceMax?: number;
  isFree: boolean;
  ticketUrl?: string;
  imageUrl?: string;
  artist?: string;
  /** Etkinlik/organizatör web sitesi (tam URL). Doluysa detayda gösterilir. */
  website?: string;
  /** Instagram bağlantısı (tam URL veya kullanıcı adı). Doluysa detayda gösterilir. */
  instagram?: string;
  /** Facebook bağlantısı (tam URL veya sayfa adı). Doluysa detayda gösterilir. */
  facebook?: string;
  /** TikTok bağlantısı (tam URL veya kullanıcı adı). Doluysa detayda gösterilir. */
  tiktok?: string;
  /** İletişim telefonu/WhatsApp. Doluysa detayda tıklanır link olarak gösterilir. */
  phone?: string;
}

export interface EventListItem extends ScrapedEvent {
  id: string;
  slug: string;
  featured: boolean;
  attendeeCount?: number;
  commentCount?: number;
}

export interface EventFilters {
  city?: string;
  country?: string;
  district?: string;
  category?: EventCategory;
  source?: EventSource;
  freeOnly?: boolean;
  from?: Date;
  to?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PlanLimits {
  plan: SubscriptionPlan;
  requestsPerDay: number;
  priceAlertsEnabled: boolean;
  webhooksEnabled: boolean;
  priorityRouting: boolean;
  monthlyPriceTL: number;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  FREE: {
    plan: "FREE",
    requestsPerDay: 100,
    priceAlertsEnabled: false,
    webhooksEnabled: false,
    priorityRouting: false,
    monthlyPriceTL: 0,
  },
  PRO: {
    plan: "PRO",
    requestsPerDay: 10_000,
    priceAlertsEnabled: true,
    webhooksEnabled: false,
    priorityRouting: false,
    monthlyPriceTL: 199,
  },
  BUSINESS: {
    plan: "BUSINESS",
    requestsPerDay: 1_000_000,
    priceAlertsEnabled: true,
    webhooksEnabled: true,
    priorityRouting: true,
    monthlyPriceTL: 799,
  },
};

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  KONSER: "Konser",
  FESTIVAL: "Festival",
  TIYATRO: "Tiyatro",
  STANDUP: "Stand-Up",
  SPOR: "Spor",
  SERGI: "Sergi",
  ATOLYE: "Atölye",
  COCUK: "Çocuk",
  FUAR: "Fuar",
  DINI: "Dini & Manevi",
  DIGER: "Diğer",
};

/** Bilinen (UNI_ öneki taşımayan) üniversite kaynakları. */
const UNIVERSITY_SOURCES = new Set(["ANADOLU_UNI", "BILKENT", "ITU", "BOGAZICI"]);

/** Kaynak bir üniversite etkinliği mi? (UNI_* veya bilinen üniv. kaynakları) */
export function isUniversitySource(source: string): boolean {
  return source.startsWith("UNI_") || UNIVERSITY_SOURCES.has(source);
}

export const SOURCE_LABELS: Record<string, string> = {
  BILETIX: "Biletix",
  BUBILET: "Bubilet",
  MOBILET: "Mobilet",
  PASSO: "Passo",
  BILETINIAL: "Biletinial",
  BUGECE: "Bugece",
  BILETINO: "Biletino",
  ZORLU_PSM: "Zorlu PSM",
  SEHIR_TIYATROLARI: "İBB Şehir Tiyatroları",
  SONGKICK: "Songkick",
  TICKETMASTER: "Ticketmaster",
  IBB: "İBB Kültür Sanat",
  ANKARA_BB: "Ankara BB",
  IZMIR_BB: "İzmir BB",
  ESKISEHIR_BB: "Eskişehir BB (Visit Eskişehir)",
  ESKISEHIR_TREND: "Eskişehir Trend",
  FESTTR: "FestTR — Kültür Festivalleri",
  FESTIVALL_TR: "Festivall.com.tr — 81 İl Festivalleri",
  ANADOLU_UNI: "Anadolu Üniversitesi",
  BILKENT: "Bilkent Üniversitesi",
  ITU: "İTÜ",
  BOGAZICI: "Boğaziçi Üniversitesi",
  TOBB: "TOBB Fuar Takvimi",
  INSTAGRAM: "Instagram",
  MANUAL: "Manuel",
};

/** Türkiye'nin 81 ili — Türkçe alfabetik sıralı (ç/ğ/ı/ş/ö/ü dahil). */
export const CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya",
  "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın",
  "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl",
  "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum",
  "Denizli", "Diyarbakır", "Düzce",
  "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
  "Gaziantep", "Giresun", "Gümüşhane",
  "Hakkari", "Hatay",
  "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu",
  "Kayseri", "Kilis", "Kırıkkale", "Kırklareli", "Kırşehir",
  "Kocaeli", "Konya", "Kütahya",
  "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
  "Nevşehir", "Niğde",
  "Ordu", "Osmaniye",
  "Rize",
  "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas",
  "Şanlıurfa", "Şırnak",
  "Tekirdağ", "Tokat", "Trabzon", "Tunceli",
  "Uşak",
  "Van",
  "Yalova", "Yozgat",
  "Zonguldak",
] as const;
