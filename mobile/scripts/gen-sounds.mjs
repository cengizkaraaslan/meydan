// Basit, hoş UI ses efektleri üretir (16-bit PCM mono WAV). Harici dosya gerekmez.
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const OUT = "assets/sounds";
mkdirSync(OUT, { recursive: true });

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

// tone: freq(t)->Hz, dur sn, vol, attack/decay envelope
function tone(freqFn, dur, vol = 0.5, decay = 6) {
  const n = (dur * SR) | 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * Math.exp(-decay * t); // hızlı attack + decay
    out[i] = Math.sin(2 * Math.PI * freqFn(t) * t) * env * vol;
  }
  return out;
}
function mix(...arrs) {
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}
function seq(parts) { // [ [delaySec, samples], ... ]
  const total = Math.max(...parts.map(([d, a]) => (d * SR | 0) + a.length));
  const out = new Float32Array(total);
  for (const [d, a] of parts) { const off = d * SR | 0; for (let i = 0; i < a.length; i++) out[off + i] += a[i]; }
  return out;
}

const sounds = {
  // yumuşak tık
  tap: tone(() => 1500, 0.045, 0.28, 30),
  // hafif pop (impact)
  pop: tone((t) => 700 + 500 * Math.min(1, t / 0.04), 0.07, 0.4, 14),
  // mesaj gönder — yukarı kayan kısa swoosh
  send: tone((t) => 600 + 1000 * Math.min(1, t / 0.09), 0.1, 0.35, 9),
  // başarı — üç notalı neşeli arpej (C5,E5,G5)
  success: seq([[0, tone(() => 523.25, 0.12, 0.4, 8)], [0.07, tone(() => 659.25, 0.12, 0.4, 8)], [0.14, tone(() => 783.99, 0.22, 0.45, 6)]]),
  // eşleşme — daha şenlikli yükselen 4 nota
  match: seq([[0, tone(() => 587.33, 0.12, 0.4, 7)], [0.09, tone(() => 739.99, 0.12, 0.4, 7)], [0.18, tone(() => 880, 0.12, 0.42, 7)], [0.27, mix(tone(() => 1046.5, 0.3, 0.4, 5), tone(() => 1318.5, 0.3, 0.25, 5))]]),
};

for (const [name, samples] of Object.entries(sounds)) {
  const f = `${OUT}/${name}.wav`;
  writeFileSync(f, wav(samples));
  console.log("yazıldı", f, ((44 + samples.length * 2) / 1024).toFixed(1) + "KB");
}
console.log("Bitti.");
