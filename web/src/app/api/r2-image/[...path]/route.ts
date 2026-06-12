import { NextResponse, type NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2, R2_BUCKET, isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * R2'deki bir nesneyi proxy olarak servis eder.
 *
 * Sebep: R2_PUBLIC_URL env var'ı yapılandırılmadığında veya R2 bucket'a
 * public access verilmediğinde, client R2'ye doğrudan erişemez. Bu endpoint
 * sunucu tarafında AWS SDK ile nesneyi okur ve image bytes olarak döndürür.
 *
 * Kullanım: <img src="/api/r2-image/test/stories/1234-foto.jpg">
 *
 * Cache: 1 gün public — CDN ve tarayıcı önbelleğe alır.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 yapılandırılmamış" },
      { status: 503 },
    );
  }

  const { path } = await params;
  const key = path.join("/");
  if (!key) {
    return NextResponse.json({ error: "Geçersiz path" }, { status: 400 });
  }

  try {
    const res = await getR2().send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      }),
    );

    if (!res.Body) {
      return NextResponse.json({ error: "Görsel bulunamadı" }, { status: 404 });
    }

    // Stream → buffer (AWS SDK ReadableStream)
    const stream = res.Body as ReadableStream<Uint8Array>;
    // Ses dosyaları için STANDART MIME'a normalize et: Android ExoPlayer "audio/m4a"yı tanımayıp
    // çalmayabiliyor; uzantıdan türet (".m4a/.aac/.mp4" → "audio/mp4"). Eski yüklemeler de düzelir.
    const lower = key.toLowerCase();
    const audioType =
      lower.endsWith(".m4a") || lower.endsWith(".aac") || lower.endsWith(".mp4")
        ? "audio/mp4"
        : lower.endsWith(".mp3")
          ? "audio/mpeg"
          : lower.endsWith(".wav")
            ? "audio/wav"
            : lower.endsWith(".webm")
              ? "audio/webm"
              : lower.endsWith(".ogg")
                ? "audio/ogg"
                : null;
    const contentType = audioType ?? res.ContentType ?? "image/jpeg";

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Length": res.ContentLength?.toString() ?? "",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "R2 GET hatası";
    if (message.includes("NoSuchKey") || message.includes("404")) {
      return NextResponse.json({ error: "Görsel yok" }, { status: 404 });
    }
    console.error("[r2-image] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
