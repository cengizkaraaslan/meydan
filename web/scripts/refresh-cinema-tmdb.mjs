#!/usr/bin/env node
/**
 * TMDB API'sinden filmlerin gerçek poster + backdrop URL'lerini çeker
 * ve src/lib/cinema-data.ts'i günceller.
 *
 * Kullanım: node scripts/refresh-cinema-tmdb.mjs
 *
 * API anahtarı: PlatfooormMovie-React-orj/api/moviedb.js'den alındı (read-only).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CINEMA_DATA = join(__dirname, "..", "src", "lib", "cinema-data.ts");

const TMDB_BEARER = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxZmRjM2QwMGJmMmFkODQ2ZjBlYzliMTk5OGJhYTBmOCIsInN1YiI6IjY1ZWNiMjY5Mjc5MGJmMDE3YzQzM2Q1YiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.QjJOz1OuBaI3UZUVIeC_UCsLn5oplMb4zel4H1-uTPQ";
const TMDB_BASE = "https://api.themoviedb.org/3";

/** Türkçe + İngilizce başlıklarla TMDB'de ara — yıl + ilk eşleşmeyi alır */
async function searchMovie(title, originalTitle, year) {
  const queries = [
    { q: originalTitle, lang: "en-US" },
    { q: title, lang: "tr-TR" },
    { q: originalTitle, lang: "tr-TR" },
    { q: title, lang: "en-US" },
  ].filter((x) => x.q);

  for (const { q, lang } of queries) {
    const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(q)}&language=${lang}${year ? `&year=${year}` : ""}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_BEARER}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.results?.length > 0) {
      // Yıl varsa en yakın yıllıyı seç, yoksa ilk
      if (year) {
        const matched = data.results.find((r) =>
          r.release_date?.startsWith(String(year)),
        );
        if (matched) return matched;
      }
      return data.results[0];
    }
  }
  return null;
}

const CURRENT_DATA = await readFile(CINEMA_DATA, "utf8");

// posterUrl + backdropUrl satırlarını bul
// id ile slug'a göre eşleşmek için tek tek arayalım
const FILMS = [
  { id: "m1",  title: "Dune: Bölüm Üç",              originalTitle: "Dune: Part Three",            year: 2026 },
  { id: "m2",  title: "Kurak Günler 2",              originalTitle: "Burning Days 2",              year: 2026 },
  { id: "m3",  title: "Avatar: Ateş ve Kül",         originalTitle: "Avatar: Fire and Ash",        year: 2025 },
  { id: "m4",  title: "Wicked: For Good",            originalTitle: "Wicked: For Good",            year: 2025 },
  { id: "m5",  title: "Bergen 2",                    originalTitle: "Bergen 2",                    year: 2026 },
  { id: "m6",  title: "Inside Out 3",                originalTitle: "Inside Out 3",                year: 2027 },
  { id: "m7",  title: "Spider-Man: Brand New Day",   originalTitle: "Spider-Man: Brand New Day",   year: 2026 },
  { id: "m8",  title: "Mission: Impossible — Final Reckoning", originalTitle: "Mission: Impossible — The Final Reckoning", year: 2025 },
  { id: "m9",  title: "Asaf İstanbul",               originalTitle: "Asaf Istanbul",               year: 2026 },
  { id: "m10", title: "Oppenheimer IMAX",            originalTitle: "Oppenheimer",                 year: 2023 },
  { id: "m11", title: "Rafadan Tayfa: Galaktik Tayfa", originalTitle: "Rafadan Tayfa Galaktik Tayfa", year: 2024 },
  { id: "m12", title: "Anatomi",                     originalTitle: "Anatomy of a Fall",           year: 2023 },
  { id: "m13", title: "Batman: The Brave and the Bold", originalTitle: "Batman: The Brave and the Bold", year: 2027 },
  { id: "m14", title: "Deli mi Ne 2",                originalTitle: "Deli mi Ne 2",                year: 2026 },
  { id: "m15", title: "Kralın İhaneti",              originalTitle: "The King's Betrayal",         year: 2026 },
];

console.log("\n🎬 TMDB'den film posterleri çekiliyor...\n");

const updates = [];
for (const film of FILMS) {
  const result = await searchMovie(film.title, film.originalTitle, film.year);
  if (!result) {
    console.log(`  ✗ ${film.id}  ${film.title}  — bulunamadı`);
    continue;
  }
  const poster = result.poster_path
    ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
    : null;
  const backdrop = result.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
    : null;
  console.log(`  ✓ ${film.id}  ${result.title || result.original_title}  (${result.release_date || "?"})`);
  console.log(`     poster:   ${poster ? "✓" : "—"}`);
  console.log(`     backdrop: ${backdrop ? "✓" : "—"}`);
  updates.push({ id: film.id, slug: film.id, poster, backdrop, tmdbId: result.id });
  await new Promise((r) => setTimeout(r, 100)); // hafif rate limit
}

// cinema-data.ts'i satır satır işle: posterUrl/backdropUrl güncelle
let updated = CURRENT_DATA;
let changeCount = 0;
for (const u of updates) {
  if (!u.poster) continue;
  // {id: "m1", ... posterUrl: "..."} bloğunu bul
  // Daha basit: id satırından sonra ilk posterUrl/backdropUrl'i değiştir
  const idAnchor = new RegExp(`id:\\s*"${u.id}",[\\s\\S]*?posterUrl:\\s*"[^"]*"`, "m");
  const m = updated.match(idAnchor);
  if (!m) {
    console.log(`  ⚠ ${u.id} blok bulunamadı`);
    continue;
  }
  const original = m[0];
  const replaced = original.replace(
    /posterUrl:\s*"[^"]*"/,
    `posterUrl: "${u.poster}"`,
  );
  updated = updated.replace(original, replaced);
  changeCount++;

  if (u.backdrop) {
    // backdropUrl varsa güncelle, yoksa posterUrl'den sonra ekle
    const afterAnchor = new RegExp(
      `(id:\\s*"${u.id}",[\\s\\S]*?posterUrl:\\s*"[^"]*",)([\\s\\S]*?)(durationMin:)`,
      "m",
    );
    const m2 = updated.match(afterAnchor);
    if (m2) {
      const between = m2[2];
      if (/backdropUrl:/.test(between)) {
        updated = updated.replace(
          /backdropUrl:\s*"[^"]*"/,
          `backdropUrl: "${u.backdrop}"`,
        );
      } else {
        const newBetween = `\n    backdropUrl: "${u.backdrop}",${between}`;
        updated = updated.replace(m2[0], m2[1] + newBetween + m2[3]);
      }
    }
  }
}

await writeFile(CINEMA_DATA, updated, "utf8");
console.log(`\n✅ cinema-data.ts güncellendi (${changeCount} film).`);
