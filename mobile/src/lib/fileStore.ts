import * as FS from "expo-file-system/legacy";

/**
 * Yerel dosya yardımcıları. Avatar/etkinlik görselleri düzenlenince yeni bir
 * jpeg dosyası üretilir; eskisini silmezsek cihaz/depolama şişer (ücretsiz tier).
 */

/** Yerel (file://) bir dosyayı sessizce siler. http/https/içerik uri'lerine dokunmaz. */
export async function deleteLocalFile(uri?: string | null): Promise<void> {
  if (!uri || !uri.startsWith("file://")) return;
  try {
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    /* yok say */
  }
}

/** Base64 JPEG'i kalıcı dizine yazar, dosya uri'sini döner. */
export async function saveBase64Jpeg(base64: string, prefix = "mf"): Promise<string> {
  const dir = FS.documentDirectory ?? FS.cacheDirectory ?? "";
  const path = `${dir}${prefix}_${Date.now()}.jpg`;
  await FS.writeAsStringAsync(path, base64, { encoding: FS.EncodingType.Base64 });
  return path;
}
