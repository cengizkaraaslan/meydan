/**
 * Renk matrisi yardımcıları (Skia ColorMatrix — 4x5, normalize 0..1).
 * Parlaklık/Kontrast/Doygunluk/Sıcaklık + Instagram-tarzı hazır filtreler.
 * İçeride 5x5 (son satır 0,0,0,0,1) ile çarpıp 20 elemana indiriyoruz.
 */
type M = number[]; // 25 eleman (5x5)

const ID5: M = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
  0, 0, 0, 0, 1,
];

function mul(a: M, b: M): M {
  const r = new Array(25).fill(0);
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      let s = 0;
      for (let k = 0; k < 5; k++) s += a[i * 5 + k] * b[k * 5 + j];
      r[i * 5 + j] = s;
    }
  }
  return r;
}

/** 5x5'in ilk 4 satırı → Skia'nın beklediği 20 eleman. */
function to20(m: M): number[] {
  return [...m.slice(0, 5), ...m.slice(5, 10), ...m.slice(10, 15), ...m.slice(15, 20)];
}

/** Parlaklık: rgb'ye offset ekler (o ∈ ~[-0.5, 0.5]). */
function brightness(o: number): M {
  const m = [...ID5];
  m[4] = o;
  m[9] = o;
  m[14] = o;
  return m;
}

/** Kontrast: 0.5 etrafında ölçekler (c=1 nötr). */
function contrast(c: number): M {
  const t = 0.5 * (1 - c);
  const m = [...ID5];
  m[0] = c; m[6] = c; m[12] = c;
  m[4] = t; m[9] = t; m[14] = t;
  return m;
}

/** Doygunluk: luminance koruyarak (s=1 nötr, 0 = gri tonlama). */
function saturation(s: number): M {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  const inv = 1 - s;
  return [
    lr * inv + s, lg * inv, lb * inv, 0, 0,
    lr * inv, lg * inv + s, lb * inv, 0, 0,
    lr * inv, lg * inv, lb * inv + s, 0, 0,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
  ];
}

/** Sıcaklık: + daha sıcak (R↑, B↓), − daha soğuk (t ∈ [-1,1]). */
function temperature(t: number): M {
  const k = 0.25 * t;
  const m = [...ID5];
  m[0] = 1 + k;
  m[12] = 1 - k;
  return m;
}

const SEPIA: M = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0, 0, 0, 1, 0,
  0, 0, 0, 0, 1,
];

export interface Adjust {
  brightness: number; // ~[-0.5, 0.5]
  contrast: number;   // ~[0.5, 1.5]
  saturation: number; // [0, 2]
  temperature: number; // [-1, 1]
}

export const NEUTRAL: Adjust = { brightness: 0, contrast: 1, saturation: 1, temperature: 0 };

/** Hazır filtreler (önce uygulanır, üstüne kullanıcı ayarları biner). */
export const PRESETS: { key: string; label: string; m: M | null }[] = [
  { key: "normal", label: "Normal", m: null },
  { key: "vivid", label: "Canlı", m: mul(contrast(1.12), saturation(1.45)) },
  { key: "warm", label: "Sıcak", m: mul(temperature(0.5), saturation(1.1)) },
  { key: "cool", label: "Soğuk", m: mul(temperature(-0.5), saturation(1.05)) },
  { key: "vintage", label: "Vintage", m: mul(temperature(0.3), mul(contrast(0.95), saturation(0.65))) },
  { key: "sepia", label: "Sepya", m: SEPIA },
  { key: "bw", label: "Siyah-Beyaz", m: mul(contrast(1.1), saturation(0)) },
  { key: "fade", label: "Soluk", m: mul(brightness(0.06), mul(contrast(0.88), saturation(0.85))) },
];

/** Ayarlar + (varsa) hazır filtre matrisini birleştirip 20 elemanlık Skia matrisi üretir. */
export function buildMatrix(a: Adjust, presetM: M | null): number[] {
  let m = ID5;
  m = mul(temperature(a.temperature), m);
  m = mul(saturation(a.saturation), m);
  m = mul(contrast(a.contrast), m);
  m = mul(brightness(a.brightness), m);
  if (presetM) m = mul(presetM, m);
  return to20(m);
}
