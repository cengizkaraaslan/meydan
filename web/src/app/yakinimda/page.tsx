import type { Metadata } from "next";
import { NearbyEventsClient } from "@/components/NearbyEventsClient";
import { RandomBuddyButton } from "@/components/RandomBuddyButton";
import { getEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yakınımdaki Etkinlikler · MeydanFest",
  description:
    "Konumuna göre Türkiye'deki en yakın konser, festival, tiyatro ve spor etkinliklerini keşfet.",
};

export default async function YakinimdaPage() {
  // İlk 30 yaklaşan etkinlik — client mesafeye göre sıralar.
  const { events } = await getEvents({ pageSize: 30, from: new Date() });

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          📍 Yakınımdaki Etkinlikler
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Konum izni verirsen sana en yakın etkinlikleri sıralarız.
        </p>
        <div className="mt-4">
          <RandomBuddyButton variant="compact" />
        </div>
      </header>

      <NearbyEventsClient initialEvents={events} />
    </div>
  );
}
