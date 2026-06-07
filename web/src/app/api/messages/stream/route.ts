import type { NextRequest } from "next/server";
import { subscribeMessages } from "@/lib/messaging-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.toLowerCase() ?? "";
  if (!username) {
    return new Response("username required", { status: 400 });
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
          // controller closed
        }
      }

      // Initial handshake
      send("hello", { username, ts: Date.now() });

      // Subscribe to bus
      unsubscribe = subscribeMessages(username, (msg) => {
        send("message", msg);
      });

      // Heartbeat 25 saniyede bir (proxy/Cloudflare timeout için)
      intervalId = setInterval(() => {
        send("ping", { ts: Date.now() });
      }, 25_000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (intervalId) clearInterval(intervalId);
        try { controller.close(); } catch { /* already closed */ }
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
