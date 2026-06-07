/**
 * Web Audio API ile sentezlenmiş basit click/notification sesleri.
 * Hiç external dosya gerektirmez, ~200 byte boyut.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Mesaj gönderme: kısa yüksek-frekanslı tık */
export function playSendSound() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(1400, t + 0.08);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.start(t);
  osc.stop(t + 0.13);
}

/** Mesaj alındı: iki tonlu kısa pop */
export function playReceiveSound() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  for (const [freq, delay] of [[660, 0], [880, 0.07]] as const) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t + delay);
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.16, t + delay + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.13);
    osc.start(t + delay);
    osc.stop(t + delay + 0.14);
  }
}

/** Story açıldı: yumuşak yukarı kayan "whoosh" */
export function playStoryOpen() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.18);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.start(t);
  osc.stop(t + 0.23);
}

/** Story geçiş: hafif kuru tık */
export function playStoryTick() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(1200, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.06, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  osc.start(t);
  osc.stop(t + 0.05);
}

/** Story başarıyla yüklendi: kısa "ding" - yükselen iki nota */
export function playSuccessDing() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  for (const [freq, delay] of [[784, 0], [1175, 0.09]] as const) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t + delay);
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.16, t + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.28);
    osc.start(t + delay);
    osc.stop(t + delay + 0.3);
  }
}

/** Buton tık - kısa, nötr */
export function playClick() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(700, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.start(t);
  osc.stop(t + 0.06);
}
