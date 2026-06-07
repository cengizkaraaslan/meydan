import "server-only";
import type { AttendanceStatus } from "./types";
import { db } from "./db";
import { withDb } from "./db-fallback";

export interface RsvpRecord {
  status: AttendanceStatus;
  createdAt: Date;
  eventStartsAt: Date;
  eventTitle: string;
  eventCity: string;
}

export interface RsvpEventMeta {
  startsAt: Date;
  title: string;
  city: string;
}

export interface RsvpEntry {
  userEmail: string;
  slug: string;
  record: RsvpRecord;
}

// -----------------------------------------------------------------------------
// Hibrit RSVP deposu. DATABASE_URL varsa (isDbConfigured) Prisma'ya gider;
// tablo henüz yoksa / DB hatası olursa in-memory Map fallback'ine düşer
// (withDb helper'ı). Bütün export'lar async — imzalar (isim + dönüş tipi) aynı,
// yalnızca Promise sarmalı.
//
// In-memory store: globalThis singleton, HMR + warm serverless invocation'larda
// hayatta kalır. RSVP için seed yok.
// -----------------------------------------------------------------------------
type Store = Map<string, Map<string, RsvpRecord>>;
const g = globalThis as unknown as { __rsvpStore?: Store };
g.__rsvpStore ??= new Map<string, Map<string, RsvpRecord>>();
export const rsvpStore: Store = g.__rsvpStore;

function userMap(userEmail: string): Map<string, RsvpRecord> {
  let m = rsvpStore.get(userEmail);
  if (!m) {
    m = new Map<string, RsvpRecord>();
    rsvpStore.set(userEmail, m);
  }
  return m;
}

// -----------------------------------------------------------------------------
// DB satırı → RsvpRecord
// -----------------------------------------------------------------------------
interface RsvpRow {
  userEmail: string;
  eventSlug: string;
  status: string;
  eventStartsAt: Date;
  eventTitle: string;
  eventCity: string;
  createdAt: Date;
}

function rowToRecord(r: RsvpRow): RsvpRecord {
  return {
    status: r.status as AttendanceStatus,
    createdAt: r.createdAt,
    eventStartsAt: r.eventStartsAt,
    eventTitle: r.eventTitle,
    eventCity: r.eventCity,
  };
}

export async function setRsvp(
  userEmail: string,
  slug: string,
  status: AttendanceStatus,
  meta: RsvpEventMeta,
): Promise<RsvpRecord> {
  return withDb(
    async () => {
      // createdAt mevcut kayıttan korunur; upsert update yolunda dokunmuyoruz.
      const r = await db.rsvp.upsert({
        where: { userEmail_eventSlug: { userEmail, eventSlug: slug } },
        create: {
          userEmail,
          eventSlug: slug,
          status,
          eventStartsAt: meta.startsAt,
          eventTitle: meta.title,
          eventCity: meta.city,
        },
        update: {
          status,
          eventStartsAt: meta.startsAt,
          eventTitle: meta.title,
          eventCity: meta.city,
        },
      });
      return rowToRecord(r);
    },
    () => {
      const m = userMap(userEmail);
      const existing = m.get(slug);
      const record: RsvpRecord = {
        status,
        createdAt: existing?.createdAt ?? new Date(),
        eventStartsAt: meta.startsAt,
        eventTitle: meta.title,
        eventCity: meta.city,
      };
      m.set(slug, record);
      return record;
    },
  );
}

export async function removeRsvp(userEmail: string, slug: string): Promise<boolean> {
  return withDb(
    async () => {
      const res = await db.rsvp.deleteMany({ where: { userEmail, eventSlug: slug } });
      return res.count > 0;
    },
    () => {
      const m = rsvpStore.get(userEmail);
      if (!m) return false;
      const ok = m.delete(slug);
      if (m.size === 0) rsvpStore.delete(userEmail);
      return ok;
    },
  );
}

export async function getRsvp(userEmail: string, slug: string): Promise<RsvpRecord | null> {
  return withDb(
    async () => {
      const r = await db.rsvp.findUnique({
        where: { userEmail_eventSlug: { userEmail, eventSlug: slug } },
      });
      return r ? rowToRecord(r) : null;
    },
    () => rsvpStore.get(userEmail)?.get(slug) ?? null,
  );
}

export async function getAllRsvpsForUser(
  userEmail: string,
): Promise<Array<{ slug: string; record: RsvpRecord }>> {
  return withDb(
    async () => {
      const rows = await db.rsvp.findMany({ where: { userEmail } });
      return rows.map((r) => ({ slug: r.eventSlug, record: rowToRecord(r) }));
    },
    () => {
      const m = rsvpStore.get(userEmail);
      if (!m) return [];
      return Array.from(m.entries()).map(([slug, record]) => ({ slug, record }));
    },
  );
}

export async function getAllUsersForEvent(
  slug: string,
): Promise<Array<{ userEmail: string; record: RsvpRecord }>> {
  return withDb(
    async () => {
      const rows = await db.rsvp.findMany({ where: { eventSlug: slug } });
      return rows.map((r) => ({ userEmail: r.userEmail, record: rowToRecord(r) }));
    },
    () => {
      const out: Array<{ userEmail: string; record: RsvpRecord }> = [];
      for (const [userEmail, m] of rsvpStore.entries()) {
        const rec = m.get(slug);
        if (rec) out.push({ userEmail, record: rec });
      }
      return out;
    },
  );
}

/**
 * [from, to) aralığında başlayan tüm (userEmail, slug, record) kayıtları.
 * Günlük reminder cron'u kullanır.
 */
export async function getAllRsvpsForTimeRange(from: Date, to: Date): Promise<RsvpEntry[]> {
  return withDb(
    async () => {
      const rows = await db.rsvp.findMany({
        where: { eventStartsAt: { gte: from, lt: to } },
      });
      return rows.map((r) => ({
        userEmail: r.userEmail,
        slug: r.eventSlug,
        record: rowToRecord(r),
      }));
    },
    () => {
      const fromMs = from.getTime();
      const toMs = to.getTime();
      const out: RsvpEntry[] = [];
      for (const [userEmail, m] of rsvpStore.entries()) {
        for (const [slug, record] of m.entries()) {
          const t = record.eventStartsAt.getTime();
          if (t >= fromMs && t < toMs) {
            out.push({ userEmail, slug, record });
          }
        }
      }
      return out;
    },
  );
}
