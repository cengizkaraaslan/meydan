import * as Haptics from "expo-haptics";

/** Her dokunuşta hafif titreşim — uygulama genelinde tutarlı haptik. */
export const tapH = () => Haptics.selectionAsync().catch(() => {});
export const impactH = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const mediumH = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
export const successH = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
