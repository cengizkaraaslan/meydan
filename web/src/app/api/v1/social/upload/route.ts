import { NextResponse, type NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2, isR2Configured, publicUrl, uploadPrefix, R2_BUCKET } from "@/lib/r2";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Sesli mesaj (kind="voice") için izinli ses türleri.
const ALLOWED_AUDIO = new Set([
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/webm",
  "audio/ogg",
  "audio/wav",
]);

/**
 * Mobil (deviceId bazlı) görsel yükleme — R2'ye koyar, public URL döner.
 * Web /api/stories/upload oturum ister; bu uç deviceId ile çalışır (mobil app).
 * POST FormData { file, kind? ("story"|"post") }
 */
export async function POST(request: NextRequest) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { ok: false, error: "Görsel sunucusu (R2) yapılandırılmamış. R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY gerekli." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Dosya bulunamadı" }, { status: 400 });
  }
  const kindParam = form.get("kind") as string | null;
  const isAudio = kindParam === "voice";
  if (isAudio ? !ALLOWED_AUDIO.has(file.type) : !ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, error: `Geçersiz tür: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: "Dosya 6 MB'tan büyük olamaz" }, { status: 400 });
  }

  const kind = isAudio ? "voice" : kindParam === "post" ? "posts" : "stories";
  // audio/x-m4a → "m4a", audio/mpeg → "mp3" gibi makul uzantı.
  const mimeExt = file.type.split("/")[1]?.replace("x-", "") ?? (isAudio ? "m4a" : "jpg");
  const ext = mimeExt === "mpeg" ? "mp3" : mimeExt;
  const baseName = slugify((file.name || (isAudio ? "voice" : "img")).replace(/\.[^.]+$/, "")) || (isAudio ? "voice" : "img");
  const key = `${uploadPrefix()}mobile/${kind}/${Date.now()}-${baseName.slice(0, 40)}.${ext}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await getR2().send(
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: file.type }),
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? `Yüklenemedi: ${err.message}` : "Yüklenemedi" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, url: publicUrl(key) });
}
