import { ImageResponse } from "next/og";
import { getEventBySlug } from "@/lib/events";

export const runtime = "nodejs";
export const alt = "MeydanFest etkinlik kartı";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CATEGORY_LABELS: Record<string, string> = {
  KONSER: "Konser",
  FESTIVAL: "Festival",
  TIYATRO: "Tiyatro",
  STANDUP: "Stand-up",
  SPOR: "Spor",
  SERGI: "Sergi",
  ATOLYE: "Atölye",
  COCUK: "Çocuk",
  DIGER: "Diğer",
};

function formatTrDate(d: Date): string {
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} · ${hour}:${min}`;
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  const title = event?.title ?? "MeydanFest";
  const city = event?.city ?? "Türkiye";
  const venue = event?.venue ?? "";
  const category = event?.category ? CATEGORY_LABELS[event.category] ?? event.category : "Etkinlik";
  const dateStr = event ? formatTrDate(new Date(event.startsAt)) : "";
  const isFree = event?.isFree ?? false;
  const priceLabel = isFree
    ? "Ücretsiz"
    : event?.priceMin
      ? `₺${event.priceMin}${event.priceMax && event.priceMax !== event.priceMin ? `-${event.priceMax}` : ""}`
      : "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 40%, #f97316 100%)",
          padding: 64,
          fontFamily: "sans-serif",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "rgba(15, 12, 30, 0.55)",
            borderRadius: 32,
            padding: 56,
            justifyContent: "space-between",
          }}
        >
          {/* Top: brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, #ec4899, #f97316)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              ✨
            </div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
              Meydan<span style={{ color: "#fbbf24" }}>Fest</span>
            </div>
          </div>

          {/* Middle: category pill + title */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 22,
              }}
            >
              <span
                style={{
                  display: "flex",
                  background: "rgba(255,255,255,0.18)",
                  padding: "8px 18px",
                  borderRadius: 999,
                  fontWeight: 600,
                }}
              >
                {category}
              </span>
              {isFree && (
                <span
                  style={{
                    display: "flex",
                    background: "#10b981",
                    padding: "8px 18px",
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  ÜCRETSİZ
                </span>
              )}
              {!isFree && priceLabel && (
                <span
                  style={{
                    display: "flex",
                    background: "rgba(255,255,255,0.18)",
                    padding: "8px 18px",
                    borderRadius: 999,
                    fontWeight: 600,
                  }}
                >
                  {priceLabel}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: title.length > 50 ? 56 : 72,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -1.5,
                maxWidth: "100%",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {title}
            </div>
          </div>

          {/* Bottom: date + venue */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 26,
              opacity: 0.92,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dateStr && <div style={{ display: "flex", fontWeight: 600 }}>📅 {dateStr}</div>}
              <div style={{ display: "flex" }}>
                📍 {venue ? `${venue}, ${city}` : city}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                background: "rgba(255,255,255,0.15)",
                padding: "12px 22px",
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              meydanfest.app
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
