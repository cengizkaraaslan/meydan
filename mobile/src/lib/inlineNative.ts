import { requireNativeModule } from "expo";

/**
 * Expo SDK 56 inline module köprüsü (native: modules/MeydanInlineModule.kt).
 * Modül henüz native'e gömülmediyse (prebuild öncesi / Expo Go) güvenle null döner.
 */
export interface NativeDeviceInfo {
  model: string;
  manufacturer: string;
  androidSdk: number;
  release: string;
}

interface MeydanInlineNative {
  greeting: string;
  deviceInfo(): NativeDeviceInfo;
}

let mod: MeydanInlineNative | null = null;
try {
  mod = requireNativeModule<MeydanInlineNative>("MeydanInlineModule");
} catch {
  mod = null; // native modül yok (prebuild yapılmamış / desteklenmiyor)
}

/** Native modül kullanılabilir mi? */
export const hasInlineModule = mod !== null;

/** Native sabit selamlama (yoksa null). */
export const inlineGreeting: string | null = mod?.greeting ?? null;

/** Native cihaz bilgisi (yoksa null). */
export function inlineDeviceInfo(): NativeDeviceInfo | null {
  try {
    return mod ? mod.deviceInfo() : null;
  } catch {
    return null;
  }
}
