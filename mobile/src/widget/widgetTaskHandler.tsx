import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { EventWidget } from "./EventWidget";
import { loadWidgetEvent } from "./widgetData";

/**
 * Widget yaşam döngüsü işleyicisi (headless). Eklendiğinde / periyodik güncellemede /
 * yeniden boyutlandırıldığında etkinliği çekip widget'ı yeniden çizer.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(<EventWidget event={await loadWidgetEvent()} />);
      break;
    default:
      break;
  }
}
