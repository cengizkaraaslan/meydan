import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isR2Configured } from "@/lib/r2";
import { presignUpload } from "@/lib/upload";

const Body = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/),
  folder: z.enum(["proposals", "events", "profile", "comments", "messages"]),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error: "Cloudflare R2 yapılandırılmamış.",
        detail: "R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY environment değişkenlerini ayarla.",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation hatası", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await presignUpload(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Presign hatası" },
      { status: 500 },
    );
  }
}
