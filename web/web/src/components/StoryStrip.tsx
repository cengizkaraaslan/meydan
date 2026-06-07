import { auth } from "@/auth";
import { getActiveUsers } from "@/lib/stories-store";
import { getEventBySlug } from "@/lib/events";
import { StoryStripClient } from "./StoryStripClient";

interface StoryStripProps {
  eventSlug?: string;
}

/**
 * Server wrapper: aktif kullanıcıları sunucudan render eder, ardından
 * client tarafı 60sn'de bir yenileme + viewer/upload state'ini yönetir.
 *
 * Strip + login değil + boşsa render edilmez.
 */
export async function StoryStrip({ eventSlug }: StoryStripProps) {
  const session = await auth().catch(() => null);
  const isLoggedIn = !!session?.user?.email;
  const viewerEmail = session?.user?.email ?? null;
  const activeUsers = await getActiveUsers(viewerEmail, { eventSlug });

  let eventTitle: string | undefined;
  if (eventSlug) {
    const ev = await getEventBySlug(eventSlug).catch(() => null);
    eventTitle = ev?.title;
  }

  if (activeUsers.length === 0 && !isLoggedIn) return null;

  return (
    <StoryStripClient
      initialUsers={activeUsers}
      isLoggedIn={isLoggedIn}
      currentUserEmail={viewerEmail}
      eventSlug={eventSlug}
      eventTitle={eventTitle}
    />
  );
}
