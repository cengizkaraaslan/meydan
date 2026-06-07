export interface ProfileData {
  username: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  instagram: string;
  facebook: string;
  instagramVisible: boolean;
  facebookVisible: boolean;
  city?: string;
  birthDate?: string;
  hobbies?: string[];
}

export const DEFAULT_PROFILE: ProfileData = {
  username: "you",
  name: "Demo Kullanıcı",
  bio: "Etkinliğe arkadaşlarımla gitmeyi seviyorum.",
  avatarUrl: null,
  instagram: "",
  facebook: "",
  instagramVisible: false,
  facebookVisible: false,
  city: "",
  birthDate: "",
  hobbies: [],
};

export const PROFILE_LS_KEY = "es.profile";

export function readProfile(): ProfileData {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_LS_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<ProfileData>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function writeProfile(p: ProfileData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_LS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

/** "@kullanici" veya "kullanici" veya tam URL → temiz username döner */
export function normalizeIgHandle(input: string): string {
  return input.trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export function normalizeFbHandle(input: string): string {
  return input.trim()
    .replace(/^https?:\/\/(?:www\.)?facebook\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
}
