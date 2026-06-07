#!/usr/bin/env node
/**
 * PWA için MeydanFest ikonlarını SVG'den PNG'ye render eder.
 * Sharp kullanır (next/image bağımlılığıyla zaten yüklü).
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const PUBLIC = new URL("../public/", import.meta.url);

// Inline gradient + sparkle ikonu — Header logosuyla aynı dil
const svg = (size, maskable = false) => {
  const padding = maskable ? Math.round(size * 0.1) : 0;
  const inner = size - padding * 2;
  const bg = maskable ? "#0f0c1e" : "transparent";
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  ${maskable ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${inner * 0.22}" fill="url(#g)"/>
  <g transform="translate(${size / 2}, ${size / 2}) scale(${size / 24 * 0.55})">
    <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" fill="white"/>
    <circle cx="-6" cy="-7" r="0.8" fill="white" opacity="0.7"/>
    <circle cx="7" cy="-5" r="0.6" fill="white" opacity="0.5"/>
    <circle cx="-5" cy="7" r="0.5" fill="white" opacity="0.6"/>
  </g>
</svg>`;
};

const targets = [
  { size: 96,  name: "icon-96.png",           maskable: false },
  { size: 192, name: "icon-192.png",          maskable: false },
  { size: 512, name: "icon-512.png",          maskable: false },
  { size: 512, name: "icon-maskable-512.png", maskable: true  },
  { size: 180, name: "apple-touch-icon.png",  maskable: false },
];

for (const t of targets) {
  const png = await sharp(Buffer.from(svg(t.size, t.maskable))).png().toBuffer();
  await writeFile(new URL(t.name, PUBLIC), png);
  console.log(`✓ ${t.name} (${png.length} bytes)`);
}

// Favicon — 32x32 ICO için PNG fallback
const fav = await sharp(Buffer.from(svg(32, false))).png().toBuffer();
await writeFile(new URL("favicon-32.png", PUBLIC), fav);
console.log("✓ favicon-32.png");
