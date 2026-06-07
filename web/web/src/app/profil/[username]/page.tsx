import Link from "next/link";
import { CalendarDays, Heart, MessageSquare, MapPin, Cake } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EventCard } from "@/components/EventCard";
import { FollowButton } from "@/components/FollowButton";
import { BadgeGrid } from "@/components/BadgeGrid";
import { findUserByUsername, MOCK_USERS, avatarUrlFor, inferGender, calcAge, profileSlugFromEmail } from "@/lib/social-data";
import { listPhotosByUserSlug } from "@/lib/gallery-store";
import { ProfileWall } from "@/components/ProfileWall";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { mockStatsForUser } from "@/lib/badges";
import { Avatar } from "@/components/ui/Avatar";
import { RevealableField, ProfileCompletionBanner } from "@/components/RevealableField";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const tEvent = await getTranslations("event");

  const clean = decodeURIComponent(username).replace(/^@/, "").toLowerCase();
  const seed = findUserByUsername(clean);
  const fallbackName = clean.charAt(0).toUpperCase() + clean.slice(1);
  const profile = seed ?? {
    username: clean,
    name: fallbackName,
    bio: "Konser ve festival meraklısı.",
    color: ["#7c3aed", "#f59e0b", "#10b981", "#06b6d4", "#ec4899"][clean.length % 5],
    followers: 0, following: 0, events: 0, igLinked: false,
    gender: inferGender(fallbackName),
    avatarUrl: avatarUrlFor(fallbackName),
  };

  const upcomingEvents = MOCK_EVENTS.slice(0, 6);

  // Kişinin duvarı: bu profile ait paylaşılan etkinlik fotoğrafları (Instagram benzeri grid)
  const wallPhotos = await listPhotosByUserSlug(clean);
  const session = await auth().catch(() => null);
  const isOwn = session?.user?.email ? profileSlugFromEmail(session.user.email) === clean : false;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <ProfileCompletionBanner />
      <header className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <Avatar
          src={profile.avatarUrl}
          name={profile.name}
          color={profile.color}
          size="size-28 sm:size-32"
          className="shadow-xl text-4xl"
        />
        <div className="flex-1 text-center sm:text-start">
          <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold">{profile.name}</h1>
          </div>
          <div className="text-[var(--muted)] mt-0.5">@{profile.username}</div>
          <p className="mt-3 text-sm max-w-md mx-auto sm:mx-0">{profile.bio}</p>

          {/* Konum + yaş meta satırı — şehir herkese açık, yaş RevealableField */}
          {(profile.city || profile.birthDate) && (
            <div className="mt-2 flex items-center justify-center sm:justify-start gap-3 text-xs text-[var(--muted)] flex-wrap">
              {profile.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3 text-[var(--primary)]" />
                  {profile.city}
                </span>
              )}
              {profile.birthDate && calcAge(profile.birthDate) != null && (
                <RevealableField field="birthDate">
                  <span className="inline-flex items-center gap-1">
                    <Cake className="size-3 text-[var(--accent)]" />
                    {calcAge(profile.birthDate)} yaşında
                  </span>
                </RevealableField>
              )}
            </div>
          )}

          {/* Hobiler — RevealableField */}
          {profile.hobbies && profile.hobbies.length > 0 && (
            <div className="mt-3">
              <RevealableField field="hobbies">
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {profile.hobbies.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center rounded-full bg-[var(--primary)]/8 text-[var(--primary)] ring-1 ring-[var(--primary)]/20 px-2.5 py-0.5 text-[11px] font-medium"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </RevealableField>
            </div>
          )}

          <div className="mt-5 flex items-center justify-center sm:justify-start gap-6">
            <Stat value={profile.events} label="etkinlik" />
            <Link href="#" className="hover:opacity-80">
              <Stat value={profile.followers} label="takipçi" />
            </Link>
            <Link href="#" className="hover:opacity-80">
              <Stat value={profile.following} label="takip" />
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-center sm:justify-start gap-2">
            <FollowButton username={profile.username} displayName={profile.name} />
            <Link
              href={`/mesaj/${profile.username}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-5 py-2 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
            >
              <MessageSquare className="size-4" /> Mesaj
            </Link>
          </div>
        </div>
      </header>

      <BadgeGrid stats={mockStatsForUser(profile.username)} hideLocked />

      <ProfileWall photos={wallPhotos} isOwn={isOwn} />

      <section className="mt-12">
        <div className="mb-5 flex items-center gap-2">
          <CalendarDays className="size-5 text-[var(--primary)]" />
          <h2 className="text-xl font-semibold">{tEvent("attendees_title")} • Gideceği etkinlikler</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingEvents.map((e, i) => (
            <EventCard key={e.id} event={e} index={i} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-center gap-2">
          <Heart className="size-5 text-[var(--danger)]" />
          <h2 className="text-xl font-semibold">Benzer kişiler</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MOCK_USERS.filter((u) => u.username !== profile.username).slice(0, 8).map((u) => (
            <Link
              key={u.username}
              href={`/profil/${u.username}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-md transition-shadow text-center"
            >
              <Avatar
                src={u.avatarUrl}
                name={u.name}
                color={u.color}
                size="size-16"
                className="text-xl"
              />
              <div className="text-sm font-medium truncate w-full">{u.name}</div>
              <div className="text-xs text-[var(--muted)]">@{u.username}</div>
              <div className="text-xs text-[var(--muted)]">{u.followers.toLocaleString("tr-TR")} takipçi</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-bold text-lg sm:text-xl">{value.toLocaleString("tr-TR")}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
