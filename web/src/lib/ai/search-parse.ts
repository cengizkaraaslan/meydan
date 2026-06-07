import "server-only";
import { getClaudeClient, AI_MODEL } from "./client";
import { CITIES, type EventCategory } from "../types";

const VALID_CATEGORIES: EventCategory[] = [
  "KONSER",
  "FESTIVAL",
  "TIYATRO",
  "STANDUP",
  "SPOR",
  "SERGI",
  "ATOLYE",
  "COCUK",
  "DIGER",
];

export interface ParsedSearch {
  params: URLSearchParams;
  summary: string;
}

interface RawParsed {
  city?: unknown;
  category?: unknown;
  search?: unknown;
  freeOnly?: unknown;
  from?: unknown;
  to?: unknown;
  summary?: unknown;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSystemPrompt(): string {
  return `Sen MeydanFest etkinlik arama asistanısın. Kullanıcının Türkçe doğal dil sorgusunu yapısal etkinlik filtrelerine çevir.

Bugünün tarihi: ${todayIso()}

ÇIKAR ALANLAR (hepsi opsiyonel — uygun olmayanı atla):
- city: Türkiye ili — SADECE şu listeden tam adı (Türkçe karakterli): ${CITIES.join(", ")}
- category: SADECE şunlardan biri: KONSER | FESTIVAL | TIYATRO | STANDUP | SPOR | SERGI | ATOLYE | COCUK | DIGER
- search: kalan anahtar kelime (sanatçı / mekan / etkinlik adı parçası)
- freeOnly: true/false — kullanıcı "ücretsiz", "bedava" derse true
- from: ISO tarih (YYYY-MM-DD) — örn. "bu hafta sonu" Cumartesi
- to: ISO tarih (YYYY-MM-DD) — örn. "bu hafta sonu" Pazar
- summary: 1 kısa Türkçe cümle ile ne arandığının özeti (örn. "İstanbul'da bu hafta sonu ücretsiz konser aranıyor")

Tarih ifadesi yorumlama:
- "bu hafta sonu" / "hafta sonu": önümüzdeki Cumartesi → önümüzdeki Pazar
- "bu hafta": bugün → önümüzdeki Pazar
- "bu ay": ayın 1'i → ayın son günü
- "yarın": yarın → yarın
- "haftaya": önümüzdeki Pazartesi → önümüzdeki Pazar

ÇIKTI: SADECE geçerli JSON döndür, başka hiçbir şey yazma. Örnek:
{"city":"İstanbul","category":"KONSER","freeOnly":true,"from":"2026-05-30","to":"2026-05-31","summary":"İstanbul'da bu hafta sonu ücretsiz konser aranıyor"}

Belirsiz / hiçbir alan çıkarılamadıysa:
{"search":"<orijinal sorgu>","summary":"<orijinal sorgu> aranıyor"}`;
}

function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fallthrough */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function buildResult(raw: RawParsed, originalText: string): ParsedSearch {
  const params = new URLSearchParams();

  if (typeof raw.city === "string") {
    const cityNorm = raw.city.trim();
    const match = (CITIES as readonly string[]).find(
      (c) => c.toLocaleLowerCase("tr") === cityNorm.toLocaleLowerCase("tr"),
    );
    if (match) params.set("city", match);
  }

  if (typeof raw.category === "string") {
    const cat = raw.category.trim().toUpperCase();
    if ((VALID_CATEGORIES as string[]).includes(cat)) {
      params.set("category", cat);
    }
  }

  if (typeof raw.search === "string" && raw.search.trim()) {
    params.set("q", raw.search.trim());
  }

  if (raw.freeOnly === true) {
    params.set("free", "1");
  }

  if (typeof raw.from === "string" && isValidIsoDate(raw.from)) {
    params.set("from", raw.from.slice(0, 10));
  }

  if (typeof raw.to === "string" && isValidIsoDate(raw.to)) {
    params.set("to", raw.to.slice(0, 10));
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim()
      : originalText;

  return { params, summary };
}

function fallback(text: string): ParsedSearch {
  const params = new URLSearchParams();
  if (text.trim()) params.set("q", text.trim());
  return { params, summary: text };
}

/**
 * Parse a Turkish natural language search query into MeydanFest filter URL params.
 * Always returns a valid result — falls back to plain text search on any failure.
 */
export async function parseSearchQuery(text: string): Promise<ParsedSearch> {
  const trimmed = text.trim();
  if (!trimmed) return { params: new URLSearchParams(), summary: "" };

  const client = getClaudeClient();
  if (!client) return fallback(trimmed);

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 300,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: trimmed }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback(trimmed);
    const parsed = extractJson(textBlock.text);
    if (!parsed || typeof parsed !== "object") return fallback(trimmed);
    return buildResult(parsed as RawParsed, trimmed);
  } catch (err) {
    console.error("[ai/search-parse] failed:", err);
    return fallback(trimmed);
  }
}
