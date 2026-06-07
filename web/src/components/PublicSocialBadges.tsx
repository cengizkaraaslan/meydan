"use client";

import { useEffect, useState } from "react";
import { InstagramIcon, FacebookIcon } from "./icons/Social";
import { readProfile } from "@/lib/profile-types";

/**
 * Sadece KENDI profilin (/profil/me veya kendi username'in) için.
 * Diğer kullanıcılar için (örn. /profil/elif) bu component göstermez —
 * çünkü onların seed verisi sunucuda, kendi visibility ayarı yok.
 * Demo amaçlı: kullanıcı kendi username'i ile sayfayı görüyorsa
 * localStorage'dan okur.
 */
export function PublicSocialBadges({ username }: { username: string }) {
  const [profile, setProfile] = useState<{ instagram: string; facebook: string; instagramVisible: boolean; facebookVisible: boolean; username: string } | null>(null);

  useEffect(() => {
    const p = readProfile();
    if (p.username.toLowerCase() === username.toLowerCase() || username === "me") {
      setProfile(p);
    }
  }, [username]);

  if (!profile) return null;
  const showIg = profile.instagramVisible && profile.instagram.trim().length > 0;
  const showFb = profile.facebookVisible && profile.facebook.trim().length > 0;
  if (!showIg && !showFb) return null;

  return (
    <div className="mt-3 inline-flex items-center gap-2 flex-wrap">
      {showIg && (
        <a
          href={`https://instagram.com/${profile.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-amber-400 text-white px-3 py-1 text-xs font-medium hover:opacity-90"
        >
          <InstagramIcon className="size-3.5" /> @{profile.instagram}
        </a>
      )}
      {showFb && (
        <a
          href={`https://facebook.com/${profile.facebook}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] text-white px-3 py-1 text-xs font-medium hover:opacity-90"
        >
          <FacebookIcon className="size-3.5" /> {profile.facebook}
        </a>
      )}
    </div>
  );
}
