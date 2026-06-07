import * as Haptics from "expo-haptics";
import { sndTap, sndPop, sndSuccess } from "./sound";
import { isHapticsEnabled } from "./prefs";

/** Her dokunuşta hafif titreşim + ses — uygulama genelinde tutarlı geri bildirim.
 *  Titreşim ayarlardan kapatılabilir (ses ayrı; sound.ts kendi içinde kontrol eder). */
export const tapH = () => {
  if (isHapticsEnabled()) Haptics.selectionAsync().catch(() => {});
  sndTap();
};
export const impactH = () => {
  if (isHapticsEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  sndPop();
};
export const mediumH = () => {
  if (isHapticsEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  sndPop();
};
export const successH = () => {
  if (isHapticsEnabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  sndSuccess();
};
