import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap, MapPin, ExternalLink, ArrowLeft, Clock, CalendarDays } from "lucide-react";
import { auth } from "@/auth";
import { getCourseBySlug } from "@/lib/courses";
import { Comments } from "@/components/Comments";
import { listComments } from "@/lib/comments-store";
import { RsvpButtons } from "@/components/RsvpButtons";
import { getRsvp } from "@/lib/rsvp-store";
import { EventTweets } from "@/components/EventTweets";
import { PageFade } from "@/components/motion/PageFade";
import { Reveal } from "@/components/motion/Reveal";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Kurs bulunamadı" };
  return {
    title: `${course.item.name} — ${course.provider.name} (Ücretsiz Kurs)`,
    description: `${course.provider.city} · ${course.provider.name} ücretsiz ${course.item.name} kursu. Katıl, yorum yaz, ön kayıt bağlantısına ulaş.`,
  };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const session = await auth().catch(() => null);
  const isLoggedIn = Boolean(session?.user);
  const viewerEmail = session?.user?.email ?? null;

  const [initialComments, rsvp] = await Promise.all([
    listComments(slug, viewerEmail ?? ""),
    viewerEmail ? getRsvp(viewerEmail, slug) : Promise.resolve(null),
  ]);

  return (
    <PageFade className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/kurslar" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-5">
        <ArrowLeft className="size-4" /> Tüm kurslar
      </Link>

      {course.item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.item.image}
          alt={course.item.name}
          className="w-full aspect-[16/9] object-cover rounded-2xl border border-[var(--border)] mb-5"
        />
      )}

      <header className="space-y-3 mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] px-3 py-1 text-xs font-semibold">
          <GraduationCap className="size-3.5" /> Ücretsiz Kurs
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">{course.item.name}</h1>
          {course.item.full ? (
            <span className="rounded-full bg-[var(--danger)]/15 text-[var(--danger)] px-2.5 py-1 text-xs font-semibold">Dolu</span>
          ) : course.item.open ? (
            <span className="rounded-full bg-[var(--success)]/15 text-[var(--success)] px-2.5 py-1 text-xs font-semibold">Kayıt Alıyor</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--muted)] flex-wrap">
          <span>{course.provider.name}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" /> {course.item.center ?? course.provider.city}
          </span>
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Katılım</div>
          <div className="mt-1 text-lg font-semibold">Ücretsiz · ön kayıt gerekli</div>
        </div>
        {(course.item.schedule || course.item.start) && (
          <div className="space-y-1.5 text-sm">
            {course.item.schedule && (
              <div className="flex items-start gap-2">
                <Clock className="size-4 shrink-0 text-[var(--muted)] mt-0.5" /> <span>{course.item.schedule}</span>
              </div>
            )}
            {(course.item.start || course.item.end) && (
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-[var(--muted)]" /> {course.item.start} – {course.item.end}
              </div>
            )}
            {course.item.note && <p className="text-xs text-[var(--muted)]">{course.item.note}</p>}
          </div>
        )}
        <RsvpButtons slug={slug} initial={rsvp?.status ?? null} isLoggedIn={isLoggedIn} showTicket={false} />
        <a
          href={course.provider.registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          {course.provider.name} ön kayıt sayfası <ExternalLink className="size-4" />
        </a>
        <p className="text-xs text-[var(--muted)]">
          Not: Resmî kayıt ilgili belediyenin sitesinden yapılır. Buradaki &quot;katıl&quot; ve yorumlar topluluk içindir.
        </p>
      </div>

      <Reveal>
        <Comments
          slug={slug}
          isLoggedIn={isLoggedIn}
          authorName={session?.user?.name ?? null}
          viewerUsername={viewerEmail}
          initialItems={initialComments}
        />
      </Reveal>

      <div className="mt-6">
        <EventTweets query={`${course.item.name} ${course.provider.city} kurs`} />
      </div>
    </PageFade>
  );
}
