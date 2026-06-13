import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Hafif UI ses efektleri. Haptiklerle birlikte tetiklenir (haptics.ts) → tüm
 * tıklama/buton/sekme yerlerinde otomatik. Eşleşme/mesaj için özel sesler de var.
 */
let enabled = true;
AsyncStorage.getItem("meydanfest:sound").then((v) => {
  if (v === "0") enabled = false;
}).catch(() => {});

export function setSoundEnabled(on: boolean) {
  enabled = on;
  AsyncStorage.setItem("meydanfest:sound", on ? "1" : "0").catch(() => {});
}
export function isSoundEnabled() {
  return enabled;
}

const SOURCES: Record<string, number> = {
  tap: require("../../assets/sounds/tap.wav"),
  pop: require("../../assets/sounds/pop.wav"),
  send: require("../../assets/sounds/send.wav"),
  success: require("../../assets/sounds/success.wav"),
  match: require("../../assets/sounds/match.wav"),
  buzz: require("../../assets/sounds/buzz.wav"),
};

const players: Record<string, AudioPlayer> = {};

function play(key: string, vol: number) {
  if (!enabled) return;
  try {
    let p = players[key];
    if (!p) {
      p = createAudioPlayer(SOURCES[key]);
      players[key] = p;
    }
    p.volume = vol;
    p.seekTo(0);
    p.play();
  } catch {
    /* ses başarısız olursa sessizce geç */
  }
}

export const sndTap = () => play("tap", 0.3);
export const sndPop = () => play("pop", 0.4);
export const sndSend = () => play("send", 0.45);
export const sndSuccess = () => play("success", 0.5);
export const sndMatch = () => play("match", 0.55);
export const sndBuzz = () => play("buzz", 0.5);
