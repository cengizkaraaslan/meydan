import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetEvent } from "./widgetData";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** Kategori kodu → Türkçe etiket (rozet için). */
const CATEGORY_LABEL: Record<string, string> = {
  KONSER: "Konser",
  FESTIVAL: "Festival",
  TIYATRO: "Tiyatro",
  STANDUP: "Stand-up",
  SPOR: "Spor",
  SERGI: "Sergi",
  ATOLYE: "Atölye",
  COCUK: "Çocuk",
  FUAR: "Fuar",
  DIGER: "Etkinlik",
};

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

/** Tek bir etkileşim sayacı: emoji + sayı (renkli, kompakt çip). */
function Stat({ emoji, value, color }: { emoji: string; value: number; color: `#${string}` }) {
  return (
    <FlexWidget
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1C1730",
        borderRadius: 9,
        paddingHorizontal: 7,
        paddingVertical: 3,
        marginRight: 6,
      }}
    >
      <TextWidget text={emoji} style={{ fontSize: 11 }} />
      <TextWidget text={` ${value}`} style={{ fontSize: 12, fontWeight: "700", color }} />
    </FlexWidget>
  );
}

/**
 * Ana ekran widget'ı — Aurora koyu kart: başlık + kategori (sağ üst) + etkinlik
 * (başlık, mekân·şehir) + etkileşim sayaçları (katılacak/belki/ilgili/yorum) + tarih.
 * Dokun → uygulamayı açar.
 */
export function EventWidget({ event }: { event: WidgetEvent | null }) {
  const categoryLabel = event ? (event.isFree ? "Ücretsiz" : CATEGORY_LABEL[event.category] || "Etkinlik") : "";
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
      {/* Üst bar: marka (sol) + kategori rozeti (SAĞA yaslı) */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget text="MEYDAN" style={{ fontSize: 12, fontWeight: "700", color: "#A78BFA" }} />
          <TextWidget
            text={event?.mine ? "  ·  senin etkinliğin" : "  ·  yakınındaki etkinlik"}
            style={{ fontSize: 11, color: "#8B83A3" }}
          />
        </FlexWidget>
        {event ? (
          <TextWidget
            text={categoryLabel}
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#0E0B1A",
              backgroundColor: event.isFree ? "#34D399" : "#A78BFA",
              borderRadius: 10,
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          />
        ) : (
          <TextWidget text="" style={{ fontSize: 11 }} />
        )}
      </FlexWidget>

      {/* Orta: başlık + mekân·şehir */}
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
            style={{ fontSize: 12, color: "#C9C3D9", marginTop: 3 }}
          />
        </FlexWidget>
      ) : (
        <TextWidget text="Dokun ve yakınındaki etkinlikleri keşfet" style={{ fontSize: 14, color: "#C9C3D9" }} />
      )}

      {/* Etkileşim sayaçları. Kendi etkinliğinde: katılacak · yorum · story (GERÇEK).
          Yakındaki etkinlikte: katılacak · belki · ilgili · yorum. */}
      {event ? (
        event.mine ? (
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <Stat emoji="✅" value={event.going} color="#34D399" />
            <Stat emoji="💬" value={event.comments} color="#C9C3D9" />
            <Stat emoji="📸" value={event.stories} color="#F472B6" />
          </FlexWidget>
        ) : (
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <Stat emoji="✅" value={event.going} color="#34D399" />
            <Stat emoji="🤔" value={event.maybe} color="#FBBF24" />
            <Stat emoji="⭐" value={event.interested} color="#60A5FA" />
            <Stat emoji="💬" value={event.comments} color="#C9C3D9" />
          </FlexWidget>
        )
      ) : (
        <FlexWidget style={{ flexDirection: "row" }} />
      )}

      {/* Alt: tarih */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
        <TextWidget
          text={event ? `🗓  ${formatDate(event.startsAt)}` : ""}
          style={{ fontSize: 12, fontWeight: "600", color: "#A78BFA" }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
