import "server-only";
import { storageRegistry } from "./storage/StorageRegistry";
import type { PresignedUpload, StorageFolder } from "./storage/StorageProvider";

export type UploadFolder = StorageFolder;
export type PresignResult = PresignedUpload;

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm",
]);

export async function presignUpload(opts: {
  folder: UploadFolder;
  filename: string;
  contentType: string;
}): Promise<PresignResult> {
  if (!ALLOWED_TYPES.has(opts.contentType)) {
    throw new Error(`Content type '${opts.contentType}' allowed değil.`);
  }
  const provider = storageRegistry.active();
  if (!provider.isConfigured()) {
    throw new Error(`Aktif storage provider '${provider.meta.displayName}' yapılandırılmamış.`);
  }
  return provider.presign(opts);
}

export async function deleteObject(key: string): Promise<void> {
  const provider = storageRegistry.active();
  await provider.delete(key);
}

export function activeProviderInfo() {
  const p = storageRegistry.active();
  return { id: p.meta.id, name: p.meta.displayName, configured: p.isConfigured() };
}
