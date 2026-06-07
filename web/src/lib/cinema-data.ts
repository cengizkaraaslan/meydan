/**
 * MOCK SİNEMA VERİSİ
 *
 * Türkiye vizyonunda olan/olmuş gerçek filmlerin tipik metadata'sı.
 * Poster URL'leri TMDB CDN (image.tmdb.org) — bunlar public CDN, auth gerektirmez.
 * Eğer bir hash bozulursa EventImage benzeri fallback yok; <Image> onError → placeholder gerekirse
 * MovieCard kendi içinde halleder.
 */

export interface CinemaShowtime {
  city: string;
  theater: string;
  times: string[];
}

export interface CinemaMovie {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  posterUrl: string;
  backdropUrl?: string;
  durationMin: number;
  genres: string[];
  rating: number;
  ageRating: string;
  director: string;
  cast: string[];
  releaseDate: string;
  synopsis: string;
  trailerUrl?: string;
  showtimes: CinemaShowtime[];
}

export const CINEMA_MOVIES: CinemaMovie[] = [
  {
    id: "m1",
    slug: "dune-part-three",
    title: "Dune: Bölüm Üç",
    originalTitle: "Dune: Part Three",
    posterUrl: "https://image.tmdb.org/t/p/w500/b4wekkUaxExzOeGe7hKXzhnyXHt.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/iN41Ccw4DctL8npfmYg1j5Tr1eb.jpg",
    durationMin: 166,
    genres: ["Bilim Kurgu", "Macera", "Drama"],
    rating: 8.4,
    ageRating: "+13",
    director: "Denis Villeneuve",
    cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson", "Javier Bardem"],
    releaseDate: "2026-12-18",
    synopsis:
      "Paul Atreides, Fremen halkı ile birlikte Arrakis'in kaderini belirleyecek son savaşa hazırlanır. Galaksinin gücü artık bir öngörünün eşiğinde.",
    trailerUrl: "https://www.youtube.com/watch?v=Way9Dexny3w",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Kanyon", times: ["13:00", "16:15", "19:30", "22:45"] },
      { city: "İstanbul", theater: "Cinemaximum Akasya", times: ["14:00", "17:30", "21:00"] },
      { city: "Ankara",   theater: "Cinemaximum Next Level", times: ["13:30", "17:00", "20:30"] },
      { city: "İzmir",    theater: "Cinemaximum Mavibahçe", times: ["14:15", "17:45", "21:15"] },
      { city: "Bursa",    theater: "Cinemaximum Korupark", times: ["15:00", "18:30", "22:00"] },
      { city: "Antalya",  theater: "Cinemaximum MarkAntalya", times: ["13:45", "17:15", "20:45"] },
    ],
  },
  {
    id: "m2",
    slug: "kurak-gunler-2",
    title: "Kurak Günler 2",
    originalTitle: "Burning Days 2",
    posterUrl: "https://image.tmdb.org/t/p/w500/4hzwBzeKnK0r3yIWh9IDGV7BUxF.jpg",
    durationMin: 128,
    genres: ["Dram", "Gerilim"],
    rating: 7.8,
    ageRating: "+18",
    director: "Emin Alper",
    cast: ["Selahattin Paşalı", "Ekin Koç", "Erol Babaoğlu"],
    releaseDate: "2026-04-25",
    synopsis:
      "Anadolu'nun kurak bir kasabasında savcı Emre'nin hikâyesi, geçmişin gölgelerinin peşine takılarak bambaşka bir yöne savrulur. Sırlar, susuzluğun rengini alır.",
    trailerUrl: "https://www.youtube.com/watch?v=Y_PpvgEKqcM",
    showtimes: [
      { city: "İstanbul", theater: "Atlas 1948 Sineması", times: ["14:30", "19:00", "21:30"] },
      { city: "Ankara",   theater: "Büyülü Fener Kızılay", times: ["15:00", "18:00", "21:00"] },
      { city: "İzmir",    theater: "Konak Pier Cinemarine", times: ["13:00", "16:30", "20:00"] },
      { city: "Antalya",  theater: "Özdilek Antalya", times: ["14:00", "18:30"] },
    ],
  },
  {
    id: "m3",
    slug: "avatar-fire-and-ash",
    title: "Avatar: Ateş ve Kül",
    originalTitle: "Avatar: Fire and Ash",
    posterUrl: "https://image.tmdb.org/t/p/w500/aabwWZWx6z1aYP4PX2ADvbDKktd.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/8icSWSrdkBJnp0PG0sB5dxYcKtY.jpg",
    durationMin: 192,
    genres: ["Bilim Kurgu", "Aksiyon", "Macera"],
    rating: 7.9,
    ageRating: "+13",
    director: "James Cameron",
    cast: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver", "Stephen Lang"],
    releaseDate: "2026-12-19",
    synopsis:
      "Sully ailesi, Pandora'nın yeni bir tehdidiyle karşılaşır: Kül Halkı. Volkanik bölgelerin Na'vi kabileleri, RDA'nın geri dönüşüyle birlikte sahneye çıkar.",
    trailerUrl: "https://www.youtube.com/watch?v=Z0PoH4VTOcM",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Zorlu Center", times: ["12:30", "16:00", "19:30", "23:00"] },
      { city: "İstanbul", theater: "Cinemaximum Watergarden", times: ["13:00", "17:00", "21:00"] },
      { city: "Ankara",   theater: "Cinemaximum Cepa", times: ["13:30", "17:30", "21:30"] },
      { city: "İzmir",    theater: "Cinemaximum Optimum", times: ["14:00", "18:00", "22:00"] },
      { city: "Bursa",    theater: "Cinemaximum Podyum Park", times: ["13:15", "17:15", "21:15"] },
      { city: "Antalya",  theater: "Cinemaximum TerraCity", times: ["14:30", "18:30", "22:30"] },
    ],
  },
  {
    id: "m4",
    slug: "inside-out-3",
    title: "Ters Yüz 3",
    originalTitle: "Inside Out 3",
    posterUrl: "https://image.tmdb.org/t/p/w500/si9tolnefLSUKaqQEGz1bWArOaL.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/cGbPBHKSFO7hSIjxkb3KOaGdOep.jpg",
    durationMin: 102,
    genres: ["Animasyon", "Aile", "Komedi"],
    rating: 8.1,
    ageRating: "Genel",
    director: "Kelsey Mann",
    cast: ["Amy Poehler", "Maya Hawke", "Lewis Black"],
    releaseDate: "2026-06-19",
    synopsis:
      "Riley üniversiteye başlıyor ve yeni duyguları Sevgi, Korku ile Sevinç'in nasıl uyum sağlayacağını henüz kimse bilmiyor. Zihindeki dengeler yeniden kuruluyor.",
    trailerUrl: "https://www.youtube.com/watch?v=LEjhY15eCx0",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum İstinye Park", times: ["11:00", "13:30", "16:00", "18:30"] },
      { city: "Ankara",   theater: "Cinemaximum Panora", times: ["11:30", "14:00", "16:30", "19:00"] },
      { city: "İzmir",    theater: "Cinemaximum Forum Bornova", times: ["12:00", "14:30", "17:00", "19:30"] },
      { city: "Bursa",    theater: "Cinemaximum Carrefour", times: ["11:45", "14:15", "16:45"] },
      { city: "Antalya",  theater: "Cinemaximum Agora", times: ["12:30", "15:00", "17:30"] },
    ],
  },
  {
    id: "m5",
    slug: "the-batman-2",
    title: "The Batman 2",
    originalTitle: "The Batman Part II",
    posterUrl: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    durationMin: 174,
    genres: ["Aksiyon", "Suç", "Gerilim"],
    rating: 8.2,
    ageRating: "+13",
    director: "Matt Reeves",
    cast: ["Robert Pattinson", "Zoë Kravitz", "Colin Farrell"],
    releaseDate: "2026-10-02",
    synopsis:
      "Gotham karanlık bir kış yaşıyor. Yarasa adam, Penguin'in yükselen suç ağıyla mücadele ederken kentin kendi yüzleştiremediği gerçeklerle yüzleşir.",
    trailerUrl: "https://www.youtube.com/watch?v=mqqft2x_Aa4",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Marmara Forum", times: ["13:30", "17:00", "20:30"] },
      { city: "İstanbul", theater: "Cinemaximum Kanyon", times: ["14:00", "17:30", "21:00"] },
      { city: "Ankara",   theater: "Cinemaximum Armada", times: ["13:00", "16:30", "20:00"] },
      { city: "İzmir",    theater: "Cinemaximum Park Bornova", times: ["14:30", "18:00", "21:30"] },
      { city: "Antalya",  theater: "Cinemaximum 5M Migros", times: ["15:00", "18:30", "22:00"] },
    ],
  },
  {
    id: "m6",
    slug: "bergen-2",
    title: "Bergen 2: Acıların Kadını",
    posterUrl: "https://image.tmdb.org/t/p/w500/5jJCrkOzNEHv7tPZuNJ5sCJ8oUu.jpg",
    durationMin: 132,
    genres: ["Biyografi", "Müzikal", "Dram"],
    rating: 7.5,
    ageRating: "+13",
    director: "Mehmet Binay",
    cast: ["Farah Zeynep Abdullah", "Erdal Beşikçioğlu"],
    releaseDate: "2026-05-15",
    synopsis:
      "Türk arabesk müziğinin kraliçesi Bergen'in trajik hayatına yeni bir bakış. Kayıp kayıtlar, mektuplar ve dönemin tanıklarıyla anlatılan ikinci perde.",
    trailerUrl: "https://www.youtube.com/watch?v=fbnRfk7szFM",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Akasya", times: ["13:00", "16:00", "19:00", "22:00"] },
      { city: "Ankara",   theater: "Cinemaximum Kentpark", times: ["14:00", "17:00", "20:00"] },
      { city: "İzmir",    theater: "Cinemaximum Hilltown", times: ["13:30", "16:30", "19:30"] },
      { city: "Bursa",    theater: "Cinemaximum Anatolium", times: ["14:30", "17:30", "20:30"] },
      { city: "Antalya",  theater: "Cinemaximum MarkAntalya", times: ["15:00", "18:00", "21:00"] },
    ],
  },
  {
    id: "m7",
    slug: "mission-impossible-final",
    title: "Görevimiz Tehlike: Son Hesaplaşma",
    originalTitle: "Mission: Impossible — The Final Reckoning",
    posterUrl: "https://image.tmdb.org/t/p/w500/yyB2VJEW3an2xCdcYCPQhn9QERR.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/vjMvFSmGUxEtqVdaZgvFee9XkZl.jpg",
    durationMin: 169,
    genres: ["Aksiyon", "Macera", "Gerilim"],
    rating: 7.7,
    ageRating: "+13",
    director: "Christopher McQuarrie",
    cast: ["Tom Cruise", "Hayley Atwell", "Ving Rhames"],
    releaseDate: "2026-05-23",
    synopsis:
      "Ethan Hunt'ın son misyonu: Yapay zekâ tehdidi 'Varlık'ı durdurmak için dünyanın dört bir yanında zamana karşı yarış. Final geliyor.",
    trailerUrl: "https://www.youtube.com/watch?v=fsQgc9pCyDU",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Watergarden", times: ["13:00", "16:30", "20:00", "23:30"] },
      { city: "Ankara",   theater: "Cinemaximum Next Level", times: ["13:30", "17:00", "20:30"] },
      { city: "İzmir",    theater: "Cinemaximum Optimum", times: ["14:00", "17:30", "21:00"] },
      { city: "Antalya",  theater: "Cinemaximum TerraCity", times: ["14:30", "18:00", "21:30"] },
    ],
  },
  {
    id: "m8",
    slug: "anatomi-bir-dusus",
    title: "Bir Düşüşün Anatomisi",
    originalTitle: "Anatomy of a Fall",
    posterUrl: "https://image.tmdb.org/t/p/w500/z53D72EAOxGRqdr7KXXWp9dJiDe.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/xPNDRM50a58uvv1il2GVZrtWjkZ.jpg",
    durationMin: 151,
    genres: ["Dram", "Suç", "Gerilim"],
    rating: 7.7,
    ageRating: "+13",
    director: "Justine Triet",
    cast: ["Sandra Hüller", "Swann Arlaud", "Milo Machado-Graner"],
    releaseDate: "2026-02-09",
    synopsis:
      "Karlı bir Fransız Alplerinde bir cesedin bulunması, ünlü bir yazarın hayatını mahkeme salonuna taşır. Doğru tek bir gerçek var mı?",
    trailerUrl: "https://www.youtube.com/watch?v=mPRregeZJAo",
    showtimes: [
      { city: "İstanbul", theater: "Beyoğlu Sineması", times: ["14:00", "17:00", "20:00"] },
      { city: "Ankara",   theater: "Büyülü Fener Kızılay", times: ["13:30", "16:30", "19:30"] },
      { city: "İzmir",    theater: "Karaca Sineması", times: ["14:30", "17:30", "20:30"] },
    ],
  },
  {
    id: "m9",
    slug: "kralin-ihaneti",
    title: "Kralın İhaneti",
    posterUrl: "https://image.tmdb.org/t/p/w500/yqkPdH8eSepvLMjLMZyiOLjVFkk.jpg",
    durationMin: 138,
    genres: ["Tarih", "Dram", "Aksiyon"],
    rating: 7.4,
    ageRating: "+13",
    director: "Çağan Irmak",
    cast: ["Engin Altan Düzyatan", "Hazal Kaya", "Mehmet Özgür"],
    releaseDate: "2026-03-14",
    synopsis:
      "Selçuklu sarayında bir entrikanın izinde, sadakat ile ihanet arasındaki ince çizgide gezinen bir komutanın hikâyesi.",
    trailerUrl: "https://www.youtube.com/watch?v=8eP3eMgD-IY",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Forum İstanbul", times: ["13:00", "16:00", "19:00", "22:00"] },
      { city: "Ankara",   theater: "Cinemaximum Cepa", times: ["13:30", "16:30", "19:30"] },
      { city: "İzmir",    theater: "Cinemaximum Forum Bornova", times: ["14:00", "17:00", "20:00"] },
      { city: "Bursa",    theater: "Cinemaximum Korupark", times: ["14:30", "17:30", "20:30"] },
    ],
  },
  {
    id: "m10",
    slug: "spider-man-beyond",
    title: "Örümcek-Adam: Ötesi",
    originalTitle: "Spider-Man: Beyond the Spider-Verse",
    posterUrl: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg",
    durationMin: 130,
    genres: ["Animasyon", "Aksiyon", "Macera"],
    rating: 8.6,
    ageRating: "Genel",
    director: "Bob Persichetti",
    cast: ["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac"],
    releaseDate: "2026-03-29",
    synopsis:
      "Miles Morales'in çoklu evrenler arası mücadelesi, en büyük testiyle yüzleşeceği bir noktaya ulaşır. Spider Society çatlamak üzere.",
    trailerUrl: "https://www.youtube.com/watch?v=cqGjhVJWtEg",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Akasya", times: ["12:00", "14:30", "17:00", "19:30"] },
      { city: "Ankara",   theater: "Cinemaximum Panora", times: ["11:30", "14:00", "16:30", "19:00"] },
      { city: "İzmir",    theater: "Cinemaximum Mavibahçe", times: ["12:30", "15:00", "17:30"] },
      { city: "Bursa",    theater: "Cinemaximum Podyum Park", times: ["13:00", "15:30", "18:00"] },
      { city: "Antalya",  theater: "Cinemaximum Agora", times: ["13:30", "16:00", "18:30"] },
    ],
  },
  {
    id: "m11",
    slug: "asaf-istanbul",
    title: "Asaf İstanbul",
    posterUrl: "https://image.tmdb.org/t/p/w500/8wxIsoTlqyZBlR9q9wEOX2WbtBl.jpg",
    durationMin: 118,
    genres: ["Komedi", "Romantik"],
    rating: 6.9,
    ageRating: "+13",
    director: "Yılmaz Erdoğan",
    cast: ["Yılmaz Erdoğan", "Cem Yılmaz", "Demet Akbağ"],
    releaseDate: "2026-01-31",
    synopsis:
      "İstanbul'un kalabalığında yolu kesişen iki yabancının, kahve, yağmur ve müzelerle örülmüş garip arkadaşlığı.",
    trailerUrl: "https://www.youtube.com/watch?v=6S5pXfNTRcU",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Zorlu Center", times: ["14:00", "17:00", "20:00"] },
      { city: "Ankara",   theater: "Cinemaximum Armada", times: ["14:30", "17:30", "20:30"] },
      { city: "İzmir",    theater: "Cinemaximum Optimum", times: ["13:00", "16:00", "19:00"] },
      { city: "Bursa",    theater: "Cinemaximum Anatolium", times: ["15:00", "18:00", "21:00"] },
    ],
  },
  {
    id: "m12",
    slug: "wicked-2",
    title: "Wicked: Bölüm İki",
    originalTitle: "Wicked: For Good",
    posterUrl: "https://image.tmdb.org/t/p/w500/1ho0d4LNZw3Y0voeKmSvPSgJOJ2.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/lDVl2jf6VB8ODl1olZ6FLvOV1gX.jpg",
    durationMin: 152,
    genres: ["Müzikal", "Fantastik", "Dram"],
    rating: 7.6,
    ageRating: "Genel",
    director: "Jon M. Chu",
    cast: ["Cynthia Erivo", "Ariana Grande", "Jonathan Bailey"],
    releaseDate: "2026-11-21",
    synopsis:
      "Oz'un kaderi, Elphaba ile Glinda arasındaki kırılgan dostluğun sınanmasıyla şekilleniyor. Şarkılar, sırlar ve bir devrim.",
    trailerUrl: "https://www.youtube.com/watch?v=qm-3J6Y1F1A",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum İstinye Park", times: ["13:30", "17:00", "20:30"] },
      { city: "İstanbul", theater: "Cinemaximum Marmara Forum", times: ["14:00", "17:30", "21:00"] },
      { city: "Ankara",   theater: "Cinemaximum Next Level", times: ["13:00", "16:30", "20:00"] },
      { city: "İzmir",    theater: "Cinemaximum Forum Bornova", times: ["14:30", "18:00", "21:30"] },
      { city: "Antalya",  theater: "Cinemaximum TerraCity", times: ["15:00", "18:30", "22:00"] },
    ],
  },
  {
    id: "m13",
    slug: "deli-mi-ne-2",
    title: "Deli mi Ne 2",
    posterUrl: "https://image.tmdb.org/t/p/w500/yqkPdH8eSepvLMjLMZyiOLjVFkk.jpg",
    durationMin: 105,
    genres: ["Komedi"],
    rating: 6.4,
    ageRating: "+13",
    director: "Murat Aslan",
    cast: ["Şahan Gökbakar", "Demet Evgar"],
    releaseDate: "2026-02-14",
    synopsis:
      "Yıllar sonra köyüne dönen Recep, akrabaları, ekinleri ve yarım kalmış aşklar arasında yine başına buyruk işler peşinde.",
    trailerUrl: "https://www.youtube.com/watch?v=kY9R-d4uLG4",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Marmara Forum", times: ["13:00", "15:30", "18:00", "20:30"] },
      { city: "Ankara",   theater: "Cinemaximum Kentpark", times: ["13:30", "16:00", "18:30", "21:00"] },
      { city: "İzmir",    theater: "Cinemaximum Hilltown", times: ["14:00", "16:30", "19:00"] },
      { city: "Bursa",    theater: "Cinemaximum Carrefour", times: ["14:30", "17:00", "19:30"] },
      { city: "Antalya",  theater: "Cinemaximum 5M Migros", times: ["15:00", "17:30", "20:00"] },
    ],
  },
  {
    id: "m14",
    slug: "oppenheimer-extended",
    title: "Oppenheimer: Genişletilmiş Versiyon",
    originalTitle: "Oppenheimer: IMAX Cut",
    posterUrl: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    durationMin: 188,
    genres: ["Biyografi", "Dram", "Tarih"],
    rating: 8.3,
    ageRating: "+13",
    director: "Christopher Nolan",
    cast: ["Cillian Murphy", "Robert Downey Jr.", "Emily Blunt"],
    releaseDate: "2026-01-12",
    synopsis:
      "J. Robert Oppenheimer'ın atom bombasının yaratıcısı olmaya giden çelişkili yolculuğu — 15 dakika ek sahneyle özel IMAX gösterimi.",
    trailerUrl: "https://www.youtube.com/watch?v=uYPbbksJxIg",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Kanyon", times: ["13:00", "17:00", "21:00"] },
      { city: "Ankara",   theater: "Cinemaximum Next Level", times: ["14:00", "18:00"] },
      { city: "İzmir",    theater: "Cinemaximum Mavibahçe", times: ["13:30", "17:30"] },
    ],
  },
  {
    id: "m15",
    slug: "rafadan-tayfa-galaktik",
    title: "Rafadan Tayfa: Galaktik Macera",
    posterUrl: "https://image.tmdb.org/t/p/w500/uG1iSE38KbWaiPaA8YlNbrZh4xy.jpg",
    durationMin: 95,
    genres: ["Animasyon", "Aile", "Komedi"],
    rating: 7.1,
    ageRating: "Genel",
    director: "İsmail Fidan",
    cast: ["Sungur Soyer", "Pınar Aydın"],
    releaseDate: "2026-01-19",
    synopsis:
      "Rafadan Tayfa bu kez uzayda! Mahalleyi kurtarmak için galaksiler arası bir maceraya atılıyorlar.",
    trailerUrl: "https://www.youtube.com/watch?v=GHe2lmlvjcM",
    showtimes: [
      { city: "İstanbul", theater: "Cinemaximum Akasya", times: ["11:00", "13:00", "15:00", "17:00"] },
      { city: "Ankara",   theater: "Cinemaximum Panora", times: ["11:30", "13:30", "15:30", "17:30"] },
      { city: "İzmir",    theater: "Cinemaximum Forum Bornova", times: ["11:00", "13:00", "15:00"] },
      { city: "Bursa",    theater: "Cinemaximum Korupark", times: ["12:00", "14:00", "16:00"] },
      { city: "Antalya",  theater: "Cinemaximum Agora", times: ["11:30", "13:30", "15:30"] },
    ],
  },
];

export function getMovieBySlug(slug: string): CinemaMovie | null {
  return CINEMA_MOVIES.find((m) => m.slug === slug) ?? null;
}

export function getMoviesByCity(city: string): CinemaMovie[] {
  const c = city.toLocaleLowerCase("tr");
  return CINEMA_MOVIES.filter((m) =>
    m.showtimes.some((s) => s.city.toLocaleLowerCase("tr") === c),
  );
}

export function getCinemaCities(): string[] {
  const set = new Set<string>();
  for (const m of CINEMA_MOVIES) {
    for (const s of m.showtimes) set.add(s.city);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
}

/** İlk seansın tarih-saatini Date olarak döndür. Reminder cron'u için "etkinlik başlangıcı" gibi davranır. */
export function getMovieFirstShowtime(movie: CinemaMovie): { date: Date; city: string; theater: string; time: string } | null {
  for (const s of movie.showtimes) {
    if (s.times.length > 0) {
      const [hh, mm] = s.times[0].split(":").map((x) => parseInt(x, 10));
      const release = new Date(movie.releaseDate);
      const now = new Date();
      // Bugün veya release sonrası ilk uygun tarih
      const base = release.getTime() > now.getTime() ? release : now;
      const d = new Date(base);
      d.setHours(hh ?? 14, mm ?? 0, 0, 0);
      // Eğer bugün ve saat geçmişse yarına al
      if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
      return { date: d, city: s.city, theater: s.theater, time: s.times[0] };
    }
  }
  return null;
}
