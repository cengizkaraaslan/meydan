import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetEvent } from "./widgetData";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** ISO tarihi "12 Haz · 20:00" biçimine çevirir (headless'ta locale'e bağımlı değil). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
  } catch {
    return "";
  }
}

/**
 * Ana ekran widget'ı — Aurora koyu kart: "MEYDAN" başlık + yaklaşan etkinlik
 * (başlık, mekân·şehir, tarih, ücretsiz/kategori rozeti). Dokun → uygulamayı açar.
 */
export function EventWidget({ event }: { event: WidgetEvent | null }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 14,
        backgroundColor: "#0E0B1A",
        borderRadius: 22,
      }}
    >
      <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
        <TextWidget text="MEYDAN" style={{ fontSize: 12, fontWeight: "700", color: "#A78BFA" }} />
        <TextWidget text="  ·  yakınındaki etkinlik" style={{ fontSize: 11, color: "#8B83A3" }} />
      </FlexWidget>

      {event ? (
        <FlexWidget style={{ flexDirection: "column" }}>
          <TextWidget
            text={event.title}
            maxLines={2}
            truncate="END"
            style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}
          />
          <TextWidget
            text={[event.venue, event.city].filter(Boolean).join(" · ")}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 12, color: "#C9C3D9", marginTop: 4 }}
          />
        </FlexWidget>
      ) : (
        <TextWidget
          text="Dokun ve yakınındaki etkinlikleri keşfet"
          style={{ fontSize: 14, color: "#C9C3D9" }}
        />
      )}

      <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TextWidget
          text={event ? formatDate(event.startsAt) : ""}
          style={{ fontSize: 12, fontWeight: "600", color: "#A78BFA" }}
        />
        {event ? (
          <TextWidget
            text={event.isFree ? "Ücretsiz" : event.category || "Etkinlik"}
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: "#0E0B1A",
              backgroundColor: "#A78BFA",
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          />
        ) : (
          <TextWidget text="" style={{ fontSize: 11 }} />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
