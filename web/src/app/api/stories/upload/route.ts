import { NextResponse, type NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { getR2, isR2Configured, publicUrl, uploadPrefix, R2_BUCKET } from "@/lib/r2";
import { addStoryAction } from "@/lib/stories-actions";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Story foto yükleme — SERVER-SIDE.
 *
 * Sebep: Client tarafından R2'ye direct PUT, CORS preflight'ından
 * geçemiyor (Cloudflare R2'de bucket CORS yapılandırması gerekir
 * ve bu Vercel'den ayarlanamıyor). Server tarafından AWS SDK ile
 * direct upload yaparak CORS problemini tamamen atlatıyoruz.
 *
 * Akış:
 *   1. Client: POST FormData { file, caption?, eventSlug? }
 *   2. Server: auth + validate + R2'ye yükle
 *   3. Server: addStoryAction ile in-memory store'a kaydet
 *   4. Response: { ok, story } veya { ok: false, error }
 */
export async function POST(request: NextRequest) {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Giriş yapmalısın" },
      { status: 401 },
    );
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Foto sunucusu (R2) yapılandırılmamış. Yöneticiye bildir: R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Geçersiz form data" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Foto bulunamadı" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: `Geçersiz dosya türü: ${file.type}` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Dosya 5 MB'tan büyük olamaz" },
      { status: 400 },
    );
  }

  // Key üret: test/stories/{ts}-{slug}.{ext}
  const ext = file.type.split("/")[1] ?? "jpg";
  const baseName = slugify(file.name.replace(/\.[^.]+$/, "")) || "story";
  const key = `${uploadPrefix()}stories/${Date.now()}-${baseName.slice(0, 40)}.${ext}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await getR2().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: file.type,
      }),
    );
  } catch (err) {
    console.error("[stories/upload] R2 PUT error:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? `Foto sunucuya yüklenemedi: ${err.message}`
            : "Foto sunucuya yüklenemedi",
      },
      { status: 500 },
    );
  }

  const imageUrl = publicUrl(key);
  const caption = (form.get("caption") as string | null)?.trim() || undefined;
  const eventSlug = (form.get("eventSlug") as string | null) || undefined;

  const res = await addStoryAction({
    imageUrl,
    caption,
    eventSlug,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error ?? "Story kaydedilemedi" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, story: res.story, imageUrl });
}
