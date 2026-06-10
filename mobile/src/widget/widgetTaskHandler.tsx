import React from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from "react-native-android-widget";
import { EventWidget } from "./EventWidget";
import { loadWidgetEvent, loadCachedWidgetEvent } from "./widgetData";

const WIDGET_NAME = "MeydanEvent";

/**
 * Widget yaşam döngüsü işleyicisi (headless). Eklendiğinde / periyodik güncellemede /
 * yeniden boyutlandırıldığında:
 *  1) ÖNCE cache'i (yoksa placeholder'ı) ANINDA çizer → ekranda boş bekleme olmaz,
 *  2) sonra taze etkinliği çekip yeniden çizer.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      // 1) Anında ilk çizim (cache varsa gerçek etkinlik, yoksa placeholder).
      const cached = await loadCachedWidgetEvent();
      props.renderWidget(<EventWidget event={cached} />);
      // 2) Taze veriyi çek (cache'i de günceller) ve geldiyse yeniden çiz.
      try {
        const fresh = await loadWidgetEvent();
        if (fresh) props.renderWidget(<EventWidget event={fresh} />);
      } catch {
        /* ağ hatası → cache/placeholder ekranda kalır */
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Uygulama tarafından çağrılır (açılışta): widget cache'ini tazeler ve ekrandaki
 * widget'ı zorla günceller → 30 dk'lık sistem periyodunu beklemeden taze etkinlik gelir.
 * Widget ekranda yoksa sessizce geçer. Yalnız Android.
 */
export async function primeWidget(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const event = await loadWidgetEvent(); // çeker + cache'ler
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <EventWidget event={event} />,
      widgetNotFound: () => {
        /* widget ekranda değil — sorun değil */
      },
    });
  } catch {
    /* best-effort */
  }
}
