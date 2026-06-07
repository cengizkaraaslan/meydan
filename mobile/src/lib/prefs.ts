import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "./sound";

/**
 * Uygulama geneli tercihler: titreşim (haptik), animasyonları azalt, ses (sound.ts'te).
 * Senkron erişim için modül seviyesinde cache tutulur (haptics.ts gibi sync çağrılar
 * AsyncStorage'ı beklemeden okusun). Değişiklikler dinleyicilere bildirilir.
 */
const KEY_HAPTICS = "meydanfest:haptics";
const KEY_MOTION = "meydanfest:reduceMotion";
const KEY_SEEN_INTRO = "meydanfest:seenIntro";

let _haptics = true;
let _reduceMotion = false;

AsyncStorage.multiGet([KEY_HAPTICS, KEY_MOTION])
  .then((entries) => {
    for (const [k, v] of entries) {
      if (k === KEY_HAPTICS && v === "0") _haptics = false;
      if (k === KEY_MOTION && v === "1") _reduceMotion = true;
    }
    notify();
  })
  .catch(() => {});

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export const isHapticsEnabled = () => _haptics;
export const isReduceMotion = () => _reduceMotion;

export function setHapticsEnabled(on: boolean) {
  _haptics = on;
  AsyncStorage.setItem(KEY_HAPTICS, on ? "1" : "0").catch(() => {});
  notify();
}
export function setReduceMotion(on: boolean) {
  _reduceMotion = on;
  AsyncStorage.setItem(KEY_MOTION, on ? "1" : "0").catch(() => {});
  notify();
}

// ── Tanıtım turunu tekrar göster ──
const tourListeners = new Set<() => void>();
export function onReplayTour(fn: () => void) {
  tourListeners.add(fn);
  return () => {
    tourListeners.delete(fn);
  };
}
export function replayTour() {
  AsyncStorage.setItem(KEY_SEEN_INTRO, "0").catch(() => {});
  tourListeners.forEach((l) => l());
}

/** Ayar ekranı için reaktif tercih kancası. */
export function usePrefs() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    haptics: _haptics,
    reduceMotion: _reduceMotion,
    sound: isSoundEnabled(),
    setHaptics: setHapticsEnabled,
    setReduceMotion,
    setSound: (on: boolean) => {
      setSoundEnabled(on);
      force((x) => x + 1);
    },
  };
}
