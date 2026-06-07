import * as Haptics from "expo-haptics";
import { sndTap, sndPop, sndSuccess } from "./sound";

/** Her dokunuşta hafif titreşim + ses — uygulama genelinde tutarlı geri bildirim. */
export const tapH = () => {
  Haptics.selectionAsync().catch(() => {});
  sndTap();
};
export const impactH = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  sndPop();
};
export const mediumH = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  sndPop();
};
export const successH = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  sndSuccess();
};
