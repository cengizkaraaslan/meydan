"use server";

import { auth } from "@/auth";
import { getEventBySlug } from "@/lib/events";
import { getCourseBySlug } from "@/lib/courses";
import { getMovieBySlug, getMovieFirstShowtime } from "@/lib/cinema-data";
import {
  getRsvp,
  removeRsvp,
  setRsvp,
} from "@/lib/rsvp-store";
import type { AttendanceStatus } from "@/lib/types";

export type SetRsvpResult = { ok: boolean; error?: string };

export async function setRsvpAction(
  slug: string,
  status: AttendanceStatus | null,
): Promise<SetRsvpResult> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email;
  if (!email) return { ok: false, error: "unauthenticated" };

  if (status === null) {
    await removeRsvp(email, slug);
    return { ok: true };
  }

  const event = await getEventBySlug(slug);
  if (event) {
    await setRsvp(email, slug, status, {
      startsAt: event.startsAt,
      title: event.title,
      city: event.city,
    });
    return { ok: true };
  }

  // Etkinlik değilse kurs slug'ı olabilir (kurs detay sayfasından "katıl").
  const course = await getCourseBySlug(slug);
  if (course) {
    await setRsvp(email, slug, status, {
      startsAt: new Date(),
      title: course.item.name,
      city: course.provider.city,
    });
    return { ok: true };
  }

  return { ok: false, error: "event_not_found" };
}

export async function getMyRsvpAction(
  slug: string,
): Promise<{ status: AttendanceStatus | null }> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email;
  if (!email) return { status: null };
  const rec = await getRsvp(email, slug);
  return { status: rec?.status ?? null };
}

/**
 * Film için RSVP. Slug formatı `movie:<movieSlug>`.
 * Aynı rsvp-store kullanıyoruz; meta'ya filmin ilk seans tarihini, başlığını ve şehrini koyuyoruz.
 * Bu sayede reminder cron'u (tarih aralığı taraması) filmleri de otomatik kapsar.
 */
export async function setMovieRsvpAction(
  movieSlug: string,
  status: AttendanceStatus | null,
): Promise<SetRsvpResult> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email;
  if (!email) return { ok: false, error: "unauthenticated" };

  const namespaced = `movie:${movieSlug}`;

  if (status === null) {
    await removeRsvp(email, namespaced);
    return { ok: true };
  }

  const movie = getMovieBySlug(movieSlug);
  if (!movie) return { ok: false, error: "event_not_found" };

  const first = getMovieFirstShowtime(movie);
  const startsAt = first?.date ?? new Date(movie.releaseDate);
  const city = first?.city ?? movie.showtimes[0]?.city ?? "İstanbul";
  const seansLabel = first ? ` (${first.time})` : "";

  await setRsvp(email, namespaced, status, {
    startsAt,
    title: `🎬 ${movie.title}${seansLabel}`,
    city,
  });
  return { ok: true };
}
