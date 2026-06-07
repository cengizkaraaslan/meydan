import type { EventCategory } from "./types";

export type ProposalStatus = "PENDING" | "PROMOTED" | "REJECTED";

export interface ProposalItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  suggestedDate: Date;
  suggestedVenue: string;
  suggestedCity: string;
  category: EventCategory;
  creatorUsername: string;
  creatorName: string;
  attendeeCount: number;
  threshold: number; // 10
  status: ProposalStatus;
  /** Kapak görseli (Unsplash veya R2) */
  imageUrl?: string;
  /** Resmi MeydanFest ekibi tarafından açılmış post (sabit + üstte) */
  pinned?: boolean;
  /** Topluluk tartışma başlatma postu — eşiği yok, "tavsiye yaz" tarzı */
  isDiscussion?: boolean;
}

function daysFromNow(n: number, hour = 20, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export const MOCK_PROPOSALS: ProposalItem[] = [
  {
    id: "p0",
    slug: "admin-sizi-dinliyor",
    title: "👋 Admin Sizi Dinliyor",
    description:
      "Merhaba MeydanFest topluluğu! Buraya gelmenizden çok mutluyuz. " +
      "Sizin için en iyi etkinlik deneyimini oluşturmaya çalışıyoruz. " +
      "Hangi şehirde hangi etkinlikleri görmek istersiniz? Hangi özellikleri eklemeliyiz? " +
      "Bir festivalde ne kaçırdığınızı hissettiğinizi yorumlarda paylaşın. " +
      "Her öneri, dilek ve tavsiye bizim için kıymetli — okuyoruz ve uyguluyoruz. \n\n" +
      "🎯 Bu hafta odaklandığımız konular:\n" +
      "• Daha fazla şehirde belediye etkinliği\n" +
      "• Üniversite festivalleri\n" +
      "• Buddy eşleşme algoritmasının iyileştirilmesi\n" +
      "• Mobil uygulama (yakında!)\n\n" +
      "Aşağıya yorum yaz, beğen, paylaş. Birlikte daha iyisini yapalım.",
    suggestedDate: new Date(),
    suggestedVenue: "MeydanFest Topluluğu",
    suggestedCity: "Global",
    category: "DIGER",
    creatorUsername: "meydanfest",
    creatorName: "MeydanFest Ekibi",
    attendeeCount: 342,
    threshold: 0,
    status: "PROMOTED",
    imageUrl:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=600&fit=crop&auto=format&q=80",
    pinned: true,
    isDiscussion: true,
  },
  {
    id: "p1",
    slug: "kadikoy-vinil-degis-tokus-bulusmasi",
    title: "Kadıköy Vinil Değiş-Tokuş Buluşması",
    description:
      "Plak koleksiyoncularını bir araya getirecek küçük çaplı bir takas etkinliği. Hedef: 1 cumartesi öğleden sonrası, ücretsiz, sahil parkında.",
    suggestedDate: daysFromNow(18, 14),
    suggestedVenue: "Yoğurtçu Parkı",
    suggestedCity: "İstanbul",
    category: "KONSER",
    creatorUsername: "ahmet",
    creatorName: "Ahmet Karaca",
    attendeeCount: 7,
    threshold: 10,
    status: "PENDING",
  },
  {
    id: "p2",
    slug: "izmir-kordon-stand-up-acik-mikrofon",
    title: "İzmir Kordon Stand-Up Açık Mikrofon",
    description:
      "Yeni komedyenler için 5 dakikalık açık mikrofon gecesi. Kordon'da bir mekânda toplanmak isteyenleri bekliyoruz.",
    suggestedDate: daysFromNow(25, 21),
    suggestedVenue: "Alsancak (henüz mekân belirlenmedi)",
    suggestedCity: "İzmir",
    category: "STANDUP",
    creatorUsername: "ege",
    creatorName: "Ege Kara",
    attendeeCount: 4,
    threshold: 10,
    status: "PENDING",
  },
  {
    id: "p3",
    slug: "ankara-tunali-kitap-takas-gunu",
    title: "Ankara Tunalı Kitap Takas Günü",
    description:
      "Tunalı Hilmi Caddesi üzerinde küçük bir kafede kitap takası. Herkes 1-3 kitap getirir; süresiz ücretsiz katılım.",
    suggestedDate: daysFromNow(12, 15),
    suggestedVenue: "Tunalı Hilmi Caddesi (mekân koordine edilecek)",
    suggestedCity: "Ankara",
    category: "ATOLYE",
    creatorUsername: "zeynep",
    creatorName: "Zeynep Taş",
    attendeeCount: 10,
    threshold: 10,
    status: "PROMOTED",
  },
  {
    id: "p4",
    slug: "bursa-uludag-sabah-yuruyusu",
    title: "Bursa Uludağ Sabah Yürüyüşü",
    description:
      "Sarıalan'dan başlayan kolay rotada grup yürüyüşü. Hedef: 15+ kişi olunca rehber tutmak.",
    suggestedDate: daysFromNow(22, 8, 30),
    suggestedVenue: "Sarıalan • Uludağ",
    suggestedCity: "Bursa",
    category: "SPOR",
    creatorUsername: "yusuf",
    creatorName: "Yusuf Aslan",
    attendeeCount: 9,
    threshold: 10,
    status: "PENDING",
  },
  {
    id: "p5",
    slug: "istanbul-fotograf-yuruyusu-balat",
    title: "İstanbul Fotoğraf Yürüyüşü • Balat",
    description:
      "Sokak fotoğrafçılığına yeni başlayanlar için Balat rotasında ücretsiz grup yürüyüşü. Hedef: 10 kişi olunca tarih kesinleşir.",
    suggestedDate: daysFromNow(16, 11),
    suggestedVenue: "Balat • Ayvansaray başlangıç",
    suggestedCity: "İstanbul",
    category: "ATOLYE",
    creatorUsername: "elif",
    creatorName: "Elif Şen",
    attendeeCount: 6,
    threshold: 10,
    status: "PENDING",
  },
  {
    id: "p6",
    slug: "izmir-konak-bostan-cocuk-atolyesi",
    title: "İzmir Konak Bostan • Çocuk Doğa Atölyesi",
    description:
      "5-9 yaş çocuklar için kent bostanında ekim-dikim atölyesi. Hedef: 10 aile.",
    suggestedDate: daysFromNow(20, 10, 30),
    suggestedVenue: "Konak Kent Bostanı",
    suggestedCity: "İzmir",
    category: "COCUK",
    creatorUsername: "duru",
    creatorName: "Duru Kaya",
    attendeeCount: 2,
    threshold: 10,
    status: "PENDING",
  },
];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  PENDING: "Beklemede",
  PROMOTED: "Etkinliğe dönüştü",
  REJECTED: "Reddedildi",
};
