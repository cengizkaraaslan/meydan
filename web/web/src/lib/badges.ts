/**
 * Rozet/seviye sistemi.
 * Mock — gerçek hesaplama yıllık özet + RSVP geçmişi üzerinden yapılacak.
 * Şimdilik istatistik girdisine bakıp rozet listesi döner.
 */

export interface BadgeDef {
  id: string;
  /** Emoji ikonu — tasarımda görsel zenginlik için */
  emoji: string;
  /** Türkçe başlık */
  title: string;
  /** Kısa açıklama */
  description: string;
  /** Tier: yüksek tier = nadir */
  tier: "bronze" | "silver" | "gold" | "diamond";
  /** Bu rozeti açan eşik */
  threshold: number;
  /** Hangi istatistiğe bakar */
  metric: keyof UserStats;
}

export interface UserStats {
  eventsAttended: number;
  citiesVisited: number;
  friendsMet: number;
  commentsPosted: number;
  likesGiven: number;
  yearsActive: number;
  festivalsAttended: number;
  concertsAttended: number;
  /** Toplam check-in sayısı — "Buradayım" kaç kez denildi */
  checkInsCount: number;
}

export const BADGE_CATALOG: BadgeDef[] = [
  // Etkinlik sayısı
  { id: "first-event",    emoji: "🎟️", title: "İlk Adım",       description: "İlk etkinliğine katıldın",         tier: "bronze",  threshold: 1,  metric: "eventsAttended" },
  { id: "explorer-5",     emoji: "🚀", title: "Kaşif",          description: "5 etkinliğe gittin",                tier: "bronze",  threshold: 5,  metric: "eventsAttended" },
  { id: "regular-15",     emoji: "🎫", title: "Düzenli",        description: "15 etkinliğe gittin",               tier: "silver",  threshold: 15, metric: "eventsAttended" },
  { id: "veteran-50",     emoji: "🏆", title: "Veteran",        description: "50 etkinliğe gittin",               tier: "gold",    threshold: 50, metric: "eventsAttended" },
  { id: "legend-100",     emoji: "💎", title: "Efsane",         description: "100 etkinliğe gittin",              tier: "diamond", threshold: 100, metric: "eventsAttended" },

  // Şehir
  { id: "city-3",         emoji: "🗺️", title: "Gezgin",         description: "3 farklı şehirde etkinliğe gittin", tier: "bronze",  threshold: 3,  metric: "citiesVisited" },
  { id: "city-10",        emoji: "✈️", title: "Türkiye Turu",   description: "10 farklı şehir gördün",            tier: "gold",    threshold: 10, metric: "citiesVisited" },

  // Sosyal
  { id: "social-3",       emoji: "🤝", title: "Sosyal",         description: "3 yeni arkadaş edindin",            tier: "bronze",  threshold: 3,  metric: "friendsMet" },
  { id: "social-10",      emoji: "🎉", title: "Topluluk Kuran", description: "10 yeni arkadaş",                   tier: "silver",  threshold: 10, metric: "friendsMet" },
  { id: "social-25",      emoji: "🌟", title: "Süper Sosyal",   description: "25 yeni arkadaş",                   tier: "gold",    threshold: 25, metric: "friendsMet" },

  // Yorum
  { id: "comment-10",     emoji: "💬", title: "Yorumcu",        description: "10 yorum yaptın",                   tier: "bronze",  threshold: 10, metric: "commentsPosted" },
  { id: "comment-50",     emoji: "📝", title: "Sıkı Yorumcu",   description: "50 yorum",                          tier: "silver",  threshold: 50, metric: "commentsPosted" },

  // Beğeni
  { id: "like-25",        emoji: "❤️", title: "Destekçi",       description: "25 etkinlik beğendin",              tier: "bronze",  threshold: 25, metric: "likesGiven" },

  // Yıl
  { id: "year-1",         emoji: "🎂", title: "1 Yıllık",       description: "Aramıza katılalı 1 yıl oldu",       tier: "silver",  threshold: 1,  metric: "yearsActive" },
  { id: "year-2",         emoji: "🥂", title: "Sadık",          description: "2 yıllık üye",                      tier: "gold",    threshold: 2,  metric: "yearsActive" },

  // Festival
  { id: "festival-3",     emoji: "🎪", title: "Festivalci",     description: "3 festivale gittin",                tier: "silver",  threshold: 3,  metric: "festivalsAttended" },
  { id: "festival-10",    emoji: "🌈", title: "Festival Kralı", description: "10 festival",                       tier: "gold",    threshold: 10, metric: "festivalsAttended" },

  // Konser
  { id: "concert-5",      emoji: "🎤", title: "Müzik Kurdu",    description: "5 konsere gittin",                  tier: "bronze",  threshold: 5,  metric: "concertsAttended" },
  { id: "concert-20",     emoji: "🎸", title: "Konser Bağımlı", description: "20 konser",                         tier: "gold",    threshold: 20, metric: "concertsAttended" },

  // Check-in — "Buradayım"
  { id: "checkin-first",  emoji: "📍", title: "İlk Check-in",   description: "İlk kez 'Buradayım' dedin",          tier: "bronze",  threshold: 1,  metric: "checkInsCount" },
  { id: "checkin-10",     emoji: "🗺️", title: "Yerinde",        description: "10 etkinlikte check-in",             tier: "silver",  threshold: 10, metric: "checkInsCount" },
  { id: "checkin-50",     emoji: "🎯", title: "Gerçek Katılımcı", description: "50 check-in",                      tier: "gold",    threshold: 50, metric: "checkInsCount" },
  { id: "checkin-100",    emoji: "👑", title: "Sahne Kralı",    description: "100 etkinlikte 'Buradayım'",         tier: "diamond", threshold: 100, metric: "checkInsCount" },
];

export interface EarnedBadge extends BadgeDef {
  earned: true;
  progress: 100;
}

export interface LockedBadge extends BadgeDef {
  earned: false;
  /** 0-100 arası ilerleme */
  progress: number;
  /** Hedefe kalan miktar */
  remaining: number;
}

export type BadgeWithProgress = EarnedBadge | LockedBadge;

/**
 * Kullanıcı istatistiklerinden tüm rozetlerin durumunu çıkarır.
 */
export function computeBadges(stats: UserStats): {
  earned: EarnedBadge[];
  locked: LockedBadge[];
  level: number;
  xp: number;
  nextLevelXp: number;
} {
  const earned: EarnedBadge[] = [];
  const locked: LockedBadge[] = [];

  for (const def of BADGE_CATALOG) {
    const value = stats[def.metric];
    if (value >= def.threshold) {
      earned.push({ ...def, earned: true, progress: 100 });
    } else {
      const pct = Math.max(0, Math.min(99, Math.round((value / def.threshold) * 100)));
      locked.push({
        ...def,
        earned: false,
        progress: pct,
        remaining: def.threshold - value,
      });
    }
  }

  // XP: rozet tier'larına göre
  const tierXp: Record<BadgeDef["tier"], number> = {
    bronze: 50,
    silver: 150,
    gold: 400,
    diamond: 1000,
  };
  const xp = earned.reduce((sum, b) => sum + tierXp[b.tier], 0);

  // Seviye: her 500 XP = 1 seviye (logaritmik değil, sade)
  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const nextLevelXp = 500 - xpInLevel;

  // Sıralama: kazanılan en yüksek tier önce, kilitli en yakın progress önce
  earned.sort((a, b) => {
    const tierOrder = { diamond: 0, gold: 1, silver: 2, bronze: 3 };
    return tierOrder[a.tier] - tierOrder[b.tier];
  });
  locked.sort((a, b) => b.progress - a.progress);

  return { earned, locked, level, xp, nextLevelXp };
}

/**
 * Mock istatistikler — kullanıcı adına göre deterministik üretir.
 * Gerçek hayatta yıllık özet + RSVP store'dan hesaplanacak.
 */
export function mockStatsForUser(username: string): UserStats {
  // Basit hash → 0-100 aralığı
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) & 0xffffffff;
  }
  const r = (offset: number) => Math.abs((h ^ (offset * 2654435761)) % 100);

  return {
    eventsAttended: r(1),
    citiesVisited: Math.min(15, Math.floor(r(2) / 7)),
    friendsMet: Math.floor(r(3) / 3),
    commentsPosted: Math.floor(r(4) / 2),
    likesGiven: r(5),
    yearsActive: Math.floor(r(6) / 30),
    festivalsAttended: Math.floor(r(7) / 15),
    concertsAttended: Math.floor(r(8) / 5),
    checkInsCount: Math.floor(r(9) / 2),
  };
}

export const TIER_COLORS: Record<BadgeDef["tier"], { bg: string; ring: string; text: string }> = {
  bronze:  { bg: "from-amber-700/20 to-amber-600/10", ring: "ring-amber-600/40",  text: "text-amber-700 dark:text-amber-400" },
  silver:  { bg: "from-slate-400/20 to-slate-300/10", ring: "ring-slate-400/40",  text: "text-slate-600 dark:text-slate-300" },
  gold:    { bg: "from-yellow-400/30 to-amber-300/20", ring: "ring-yellow-500/50", text: "text-yellow-600 dark:text-yellow-400" },
  diamond: { bg: "from-cyan-400/30 to-fuchsia-400/20", ring: "ring-cyan-400/50",  text: "text-cyan-600 dark:text-cyan-400" },
};

export const TIER_LABELS: Record<BadgeDef["tier"], string> = {
  bronze: "Bronz",
  silver: "Gümüş",
  gold: "Altın",
  diamond: "Elmas",
};
