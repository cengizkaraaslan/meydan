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

// ── SESSİZ haptic'ler: titreşim ver ama SES çalma (pref'e yine saygılı).
// Meydan gönderi etkileşimleri (ses istenmiyor) ve tab bar için.
export const tapHaptic = () => {
  if (isHapticsEnabled()) Haptics.selectionAsync().catch(() => {});
};
export const impactHaptic = () => {
  if (isHapticsEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
export const mediumHaptic = () => {
  if (isHapticsEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};
