import "server-only";
import { getClaudeClient, AI_MODEL } from "./client";
import type { EventCategory } from "../types";

/**
 * Bir etkinlik POSTER görselini (+ caption) Claude vision ile okuyup yapılandırılmış
 * etkinlik verisine çevirir. Instagram'dan gelen afişler için tasarlandı ama her
 * görsele uygulanabilir. AI yapılandırılmamışsa null döner (çağıran graceful olmalı).
 */

export interface ExtractedEvent {
  isEvent: boolean;
  confidence: number; // 0-1
  title: string;
  category: EventCategory;
  startsAtISO: string | null; // "2026-07-12T19:00:00" veya null
  venue: string;
  city: string;
  isFree: boolean;
  ticketUrl: string | null;
  description: string | null;
}

const CATEGORIES: EventCategory[] = [
  "KONSER", "FESTIVAL", "TIYATRO", "STANDUP", "SPOR", "SERGI", "ATOLYE", "COCUK", "DIGER",
];

const SYSTEM = `Sen bir etkinlik afişi okuyucususun. Sana bir görsel (genelde Türkçe bir etkinlik afişi/poster) ve gönderi metni (caption) verilir. Görseldeki ve metindeki bilgiyi birleştirip etkinliği çıkar. Afiş bir etkinlik DEĞİLSE (reklam, alıntı, ürün, selfie vb.) isEvent=false ver. Sadece geçerli JSON döndür, başka metin yazma.`;

function buildPrompt(caption: string, today: string): string {
  return `Bugünün tarihi: ${today}. Aşağıdaki gönderi metnini ve görseli kullan.

Caption:
"""${caption.slice(0, 1500)}"""

Şu JSON şemasıyla yanıt ver (tek satır metin yok, sadece JSON):
{
  "isEvent": boolean,          // gerçek bir etkinlik afişi mi
  "confidence": number,        // 0-1 arası güven
  "title": string,             // etkinlik adı (kısa)
  "category": one of ${JSON.stringify(CATEGORIES)},
  "startsAtISO": string|null,  // "YYYY-MM-DDTHH:mm:ss"; yıl yoksa bugünden sonraki en yakın mantıklı yılı kullan; saat yoksa "20:00"; tarih hiç yoksa null
  "venue": string,             // mekan adı (yoksa "")
  "city": string,              // şehir (afişten/metinden; yoksa "")
  "isFree": boolean,           // ücretsiz mi (afişte "ücretsiz/free" geçiyorsa true)
  "ticketUrl": string|null,    // bilet/kayıt linki (metinde varsa)
  "description": string|null   // 1 cümle özet (yoksa null)
}`;
}

function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* aşağıda {...} bloğu dene */
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

function validate(raw: unknown): ExtractedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const category = (CATEGORIES as string[]).includes(String(r.category))
    ? (r.category as EventCategory)
    : "DIGER";
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    isEvent: r.isEvent === true,
    confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0,
    title: str(r.title),
    category,
    startsAtISO: str(r.startsAtISO) || null,
    venue: str(r.venue),
    city: str(r.city),
    isFree: r.isFree === true,
    ticketUrl: str(r.ticketUrl) || null,
    description: str(r.description) || null,
  };
}

export async function extractEventFromImage(
  imageUrl: string,
  caption = "",
): Promise<ExtractedEvent | null> {
  const client = getClaudeClient();
  if (!client) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: buildPrompt(caption, today) },
          ],
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    return validate(extractJson(block.text));
  } catch (err) {
    console.error("[ai/extractEvent] başarısız:", err instanceof Error ? err.message : err);
    return null;
  }
}
