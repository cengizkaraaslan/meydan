import "server-only";
import { sendPush, type SendResult } from "./push-server";
import { CATEGORY_LABELS, type EventCategory } from "./types";

export interface NewEventPayload {
  title: string;
  category: EventCategory;
  slug: string;
  city: string;
}

/**
 * Yeni etkinlik eklendiğinde, ilgili kategoriye abone olmuş kullanıcılara
 * web push gönderir. Orchestrator (cron veya scraper sonrası) bunu çağırır.
 */
export async function notifyOnNewEvent(event: NewEventPayload): Promise<SendResult[]> {
  const categoryLabel = CATEGORY_LABELS[event.category] ?? "Etkinlik";
  return sendPush(event.category, {
    title: `Yeni ${categoryLabel} — ${event.city}`,
    body: event.title,
    url: `/etkinlik/${event.slug}`,
  });
}
