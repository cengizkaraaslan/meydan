"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Settings, Pencil, MessageSquare, CalendarDays, Heart, Eye, MapPin, Cake } from "lucide-react";
import { InstagramIcon, FacebookIcon } from "./icons/Social";
import { EventCard } from "./EventCard";
import { BadgeGrid } from "./BadgeGrid";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { MOCK_USERS, calcAge } from "@/lib/social-data";
import { Avatar } from "./ui/Avatar";
import { readProfile, type ProfileData, DEFAULT_PROFILE } from "@/lib/profile-types";
import { mockStatsForUser } from "@/lib/badges";

const COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#8b5cf6"];

interface Props {
  fallbackName?: string | null;
  fallbackImage?: string | null;
}

export function MyProfileView({ fallbackName, fallbackImage }: Props) {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const p = readProfile();
    if (p.username === DEFAULT_PROFILE.username && p.name === DEFAULT_PROFILE.name && fallbackName) {
      setProfile({ ...p, name: fallbackName, avatarUrl: p.avatarUrl ?? fallbackImage ?? null });
    } else {
      setProfile(p);
    }
  }, [fallbackName, fallbackImage]);

  if (!mounted) {
    return <div className="h-96 grid place-items-center text-[var(--muted)]">Yükleniyor…</div>;
  }

  const avatarColor = COLORS[(profile.name.charCodeAt(0) || 65) % COLORS.length];
  const upcomingEvents = MOCK_EVENTS.slice(0, 6);
  const similarUsers = MOCK_USERS.slice(0, 4);

  return (
    <div>
      <header className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <motion.div
          key={profile.avatarUrl ?? "default"}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="shrink-0"
        >
          {profile.avatarUrl ? (
            <span className="block size-28 sm:size-32 rounded-full overflow-hidden shadow-xl ring-2 ring-[var(--primary)]/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            </span>
          ) : (
            <span
              className="grid size-28 sm:size-32 place-items-center rounded-full text-white text-4xl font-bold shadow-xl ring-2 ring-[var(--primary)]/20"
              style={{ background: `linear-gradient(135deg, ${avatarColor}, color-mix(in oklch, ${avatarColor}, white 30%))` }}
            >
              {profile.name.charAt(0).toUpperCase()}
            </span>
          )}
        </motion.div>

        <div className="flex-1 text-center sm:text-start">
          <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold">{profile.name}</h1>
            <span className="rounded-full bg-[var(--primary)]/12 text-[var(--primary)] ring-1 ring-[var(--primary)]/30 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold">
              Sen
            </span>
          </div>
          <div className="text-[var(--muted)] mt-0.5">@{profile.username}</div>
          <p className="mt-3 text-sm max-w-md mx-auto sm:mx-0">{profile.bio}</p>

          {/* Konum + yaş meta satırı */}
          {(profile.city || profile.birthDate) && (
            <div className="mt-2 flex items-center justify-center sm:justify-start gap-3 text-xs text-[var(--muted)] flex-wrap">
              {profile.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3 text-[var(--primary)]" />
                  {profile.city}
                </span>
              )}
              {profile.birthDate && calcAge(profile.birthDate) != null && (
                <span className="inline-flex items-center gap-1">
                  <Cake className="size-3 text-[var(--accent)]" />
                  {calcAge(profile.birthDate)} yaşında
                </span>
              )}
            </div>
          )}

          {/* Hobiler chip'leri */}
          {profile.hobbies && profile.hobbies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center sm:justify-start">
              {profile.hobbies.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center rounded-full bg-[var(--primary)]/8 text-[var(--primary)] ring-1 ring-[var(--primary)]/20 px-2.5 py-0.5 text-[11px] font-medium"
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {(profile.instagramVisible && profile.instagram) || (profile.facebookVisible && profile.facebook) ? (
            <div className="mt-3 inline-flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              {profile.instagramVisible && profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-amber-400 text-white px-3 py-1 text-xs font-medium"
                >
                  <InstagramIcon className="size-3.5" /> @{profile.instagram}
                </a>
              )}
              {profile.facebookVisible && profile.facebook && (
                <a
                  href={`https://facebook.com/${profile.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] text-white px-3 py-1 text-xs font-medium"
                >
                  <FacebookIcon className="size-3.5" /> {profile.facebook}
                </a>
              )}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-center sm:justify-start gap-6">
            <Stat value={0} label="etkinlik" />
            <Stat value={0} label="takipçi" />
            <Stat value={0} label="takip" />
          </div>

          <div className="mt-5 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <Link
              href="/ayarlar/profil"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
            >
              <Pencil className="size-4" /> Profili düzenle
            </Link>
            <Link
              href={`/profil/${profile.username || "you"}`}
              title="Başkalarına nasıl göründüğünü gör"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
            >
              <Eye className="size-4" /> Önizle
            </Link>
            <Link
              href="/ayarlar"
              aria-label="Ayarlar"
              className="grid place-items-center size-10 rounded-full border border-[var(--border)] hover:bg-[var(--muted-bg)] transition-colors"
            >
              <Settings className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Sticky bottom önizleme CTA — kendi profil görünümünü kontrol et */}
      <div className="fixed bottom-24 lg:bottom-6 inset-x-4 lg:inset-x-auto lg:end-6 lg:w-auto z-30 flex justify-center lg:justify-end pointer-events-none">
        <Link
          href={`/profil/${profile.username || "you"}`}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-5 py-3 text-sm font-semibold shadow-2xl glow-primary hover:opacity-95 transition-opacity"
        >
          <Eye className="size-4" />
          Profilim nasıl görünüyor?
        </Link>
      </div>

      <BadgeGrid stats={mockStatsForUser(profile.username)} />

      <section className="mt-12">
        <div className="mb-5 flex items-center gap-2">
          <CalendarDays className="size-5 text-[var(--primary)]" />
          <h2 className="text-xl font-semibold">Önerilen etkinlikler</h2>
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
          <h2 className="text-xl font-semibold">Yakın çevren</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {similarUsers.map((u) => (
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
