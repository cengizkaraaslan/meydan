import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Ticket } from "lucide-react";
import QRCode from "qrcode";
import type { Metadata } from "next";
import { verifyTicket } from "@/lib/ticket-jwt";
import { getEventBySlug } from "@/lib/events";
import { formatEventDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dijital Bilet — MeydanFest",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyTicket(token);
  if (!payload) notFound();

  const event = await getEventBySlug(payload.slug);
  if (!event) notFound();

  const qrDataUrl = await QRCode.toDataURL(token, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-6 sm:py-10 print:py-0 print:px-0 print:max-w-full">
      <meta name="robots" content="noindex" />

      <div className="mb-4 print:hidden">
        <Link
          href={`/etkinlik/${event.slug}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="size-4" />
          Geri dön
        </Link>
      </div>

      <div
        className="relative rounded-3xl p-[2px] print:rounded-none print:p-0"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
        }}
      >
        <article className="relative rounded-[calc(1.5rem-2px)] bg-[var(--card)] overflow-hidden print:rounded-none print:bg-white print:text-black">
          {/* Header */}
          <header className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-bold">
                M
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  MeydanFest
                </span>
                <span className="text-sm font-semibold flex items-center gap-1">
                  <Ticket className="size-3.5" />
                  Dijital Bilet
                </span>
              </div>
            </div>
            <span className="text-[10px] text-[var(--muted)] font-mono">
              #{payload.issuedAt.toString(36).slice(-6).toUpperCase()}
            </span>
          </header>

          {/* QR */}
          <div className="px-6 py-6 flex flex-col items-center gap-3 border-b border-dashed border-[var(--border)]">
            <div className="rounded-2xl bg-white p-3 shadow-sm print:shadow-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR bilet kodu"
                width={320}
                height={320}
                className="block size-64 sm:size-72"
              />
            </div>
            <p className="text-xs text-[var(--muted)] text-center max-w-xs">
              Girişte bu kodu tarat. Ekran görüntüsü de kabul edilir.
            </p>
          </div>

          {/* Event info */}
          <div className="px-6 py-5 space-y-3 border-b border-dashed border-[var(--border)]">
            <h1 className="text-xl font-bold leading-tight">{event.title}</h1>
            <div className="flex items-start gap-2 text-sm text-[var(--muted)]">
              <Calendar className="size-4 mt-0.5 shrink-0" />
              <span>{formatEventDate(event.startsAt)}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-[var(--muted)]">
              <MapPin className="size-4 mt-0.5 shrink-0" />
              <span>
                {event.venue}, {event.city}
              </span>
            </div>
          </div>

          {/* User */}
          <div className="px-6 py-4 border-b border-dashed border-[var(--border)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
              Bilet sahibi
            </div>
            <div className="text-base font-semibold leading-tight">
              {payload.userName}
            </div>
            <div className="text-xs text-[var(--muted)] break-all">
              {payload.userEmail}
            </div>
          </div>

          {/* Footer */}
          <footer className="px-6 py-4 space-y-1 text-center">
            <p className="text-xs text-[var(--foreground)]">
              Bu bileti girişte göstereceksin. Ekran görüntüsü yeterli.
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Bilet aktarılamaz. Yalnızca bilet sahibi geçerlidir.
            </p>
          </footer>
        </article>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--muted)] print:hidden">
        Tarayıcının yazdır komutuyla bu bileti kağıda dökebilirsin.
      </p>
    </div>
  );
}
