import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Memoize on globalThis so dev HMR doesn't make N copies.
const G = globalThis as unknown as { __anthropic?: Anthropic | null };

/**
 * Returns a memoized Anthropic client, or null if no API key is configured.
 * Callers MUST handle the null case gracefully (no crash, no error toast).
 */
export function getClaudeClient(): Anthropic | null {
  if (G.__anthropic !== undefined) return G.__anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim() === "") {
    G.__anthropic = null;
    return null;
  }
  G.__anthropic = new Anthropic({ apiKey: key });
  return G.__anthropic;
}

// Latest Claude 4.X family — Haiku 4.5 (cheap + fast).
export const AI_MODEL: string = process.env.AI_MODEL || "claude-haiku-4-5-20251001";

export function aiConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key.trim() !== "";
}
