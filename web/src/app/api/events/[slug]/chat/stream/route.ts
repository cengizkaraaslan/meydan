import type { NextRequest } from "next/server";
import { subscribeEventChat } from "@/lib/event-chat-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const key = slug.toLowerCase();
  if (!key) {
    return new Response("slug required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller already closed
        }
      }

      send("hello", { slug: key, ts: Date.now() });

      unsubscribe = subscribeEventChat(key, (msg) => {
        send("message", msg);
      });

      intervalId = setInterval(() => {
        send("ping", { ts: Date.now() });
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
