// Özel giriş noktası: önce expo-router'ı başlat, sonra Android widget görev
// işleyicisini kaydet (react-native-android-widget headless task'ı için gerekli).
import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/widget/widgetTaskHandler";

registerWidgetTaskHandler(widgetTaskHandler);
