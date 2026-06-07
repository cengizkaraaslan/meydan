"use server";

import { auth } from "@/auth";
import { getRsvp } from "@/lib/rsvp-store";
import { signTicket } from "@/lib/ticket-jwt";

export interface GetMyTicketResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export async function getMyTicketAction(slug: string): Promise<GetMyTicketResult> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, error: "Önce giriş yap" };
  }

  const record = await getRsvp(email, slug);
  if (!record || record.status !== "GOING") {
    return { ok: false, error: "Önce etkinliğe katıl" };
  }

  const userName = session.user?.name ?? session.user?.username ?? email;
  const token = signTicket({
    slug,
    userEmail: email,
    userName,
    issuedAt: Date.now(),
  });

  return { ok: true, token };
}
