import "server-only";
import { getClaudeClient, AI_MODEL } from "./client";
import type { EventListItem } from "../types";
import { CATEGORY_LABELS } from "../types";

export interface EventSummarySections {
  forWhom: string;
  whyGo: string;
  dressCode: string;
  transit: string;
}

export interface EventSummary {
  sections: EventSummarySections;
  cachedAt: number;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  summary: EventSummary;
}

const G = globalThis as unknown as { __aiSummaryCache?: Map<string, CacheEntry> };
function cache(): Map<string, CacheEntry> {
  if (!G.__aiSummaryCache) G.__aiSummaryCache = new Map();
  return G.__aiSummaryCache;
}

function getCached(id: string): EventSummary | null {
  const entry = cache().get(id);
  if (!entry) return null;
  if (Date.now() - entry.summary.cachedAt > TTL_MS) {
    cache().delete(id);
    return null;
  }
  return entry.summary;
}

function setCached(id: string, summary: EventSummary): void {
  cache().set(id, { summary });
}

function buildPrompt(event: EventListItem): string {
  const categoryLabel = CATEGORY_LABELS[event.category] ?? event.category;
  const desc = event.description?.slice(0, 1500) ?? "(açıklama yok)";
  return [
    `Etkinlik: ${event.title}`,
    `Kategori: ${categoryLabel}`,
    `Mekan: ${event.venue}`,
    `Şehir: ${event.city}`,
    event.artist ? `Sanatçı: ${event.artist}` : null,
    `Ücret: ${event.isFree ? "Ücretsiz" : "Ücretli"}`,
    "",
    "Açıklama:",
    desc,
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM_PROMPT = `Sen Türkçe etkinlik rehberi yapan bir asistansın. Sana verilen etkinlik bilgisinden 4 kısa bölüm üret. Her bölüm en fazla 2 cümle, sade ve pratik Türkçe olsun. Asla uydurma — bilgi yoksa makul, genel bir öneri ver.

Bölümler:
- forWhom: Bu etkinlik kimler için uygun? (örn. yetişkin müzik tutkunları, aileler, gençler)
- whyGo: Neden gidilmeli? (en güçlü 1-2 cazip sebep)
- dressCode: Ne giyilmeli? (mekan ve hava düşünülerek pratik öneri)
- transit: Otopark / ulaşım önerisi (varsa metro/otobüs/araç bilgisi, yoksa genel öneri)

ÇIKTI FORMATI: SADECE geçerli JSON döndür, başka hiçbir şey yazma. Yapı:
{"forWhom":"...","whyGo":"...","dressCode":"...","transit":"..."}`;

function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  // Try direct parse first.
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall back to extracting first {...} block.
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

function validateSections(raw: unknown): EventSummarySections | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const forWhom = typeof r.forWhom === "string" ? r.forWhom.trim() : "";
  const whyGo = typeof r.whyGo === "string" ? r.whyGo.trim() : "";
  const dressCode = typeof r.dressCode === "string" ? r.dressCode.trim() : "";
  const transit = typeof r.transit === "string" ? r.transit.trim() : "";
  if (!forWhom || !whyGo || !dressCode || !transit) return null;
  return { forWhom, whyGo, dressCode, transit };
}

/**
 * Generate (or fetch from cache) a 4-section Turkish summary for an event.
 * Returns null when AI is not configured, the request fails, or output is unparseable —
 * callers should hide the section in that case.
 */
export async function generateEventSummary(
  event: EventListItem,
): Promise<EventSummary | null> {
  const cached = getCached(event.id);
  if (cached) return cached;

  const client = getClaudeClient();
  if (!client) return null;

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt(event),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const parsed = extractJson(textBlock.text);
    const sections = validateSections(parsed);
    if (!sections) return null;

    const summary: EventSummary = { sections, cachedAt: Date.now() };
    setCached(event.id, summary);
    return summary;
  } catch (err) {
    // Swallow — never crash the UI on AI failure.
    console.error("[ai/summary] generation failed:", err);
    return null;
  }
}
