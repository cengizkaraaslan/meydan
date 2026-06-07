import "server-only";
import { nanoid } from "nanoid";
import { StorageProvider, type PresignedUpload, type StorageFolder, type EnvVarStatus, type ProviderMeta } from "../StorageProvider";

const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
};

/**
 * Vercel Blob — direct upload, presigned URL desteklenmiyor (server-side handleUpload kullanılır).
 * Bu provider için client'ın özel akış izlemesi gerekir; bu yüzden forwardToServerEndpoint dönüyoruz.
 * /api/upload/vercel-blob route'unun ayrı handle etmesi gerekir.
 */
export class VercelBlobProvider extends StorageProvider {
  readonly meta: ProviderMeta = {
    id: "VERCEL_BLOB",
    displayName: "Vercel Blob",
    description: "Vercel native object storage. Setup en kolay, Vercel deploy ile entegre.",
    url: "https://vercel.com/docs/storage/vercel-blob",
    freeTier: "100 GB-saat + 50 GB bandwidth",
  };

  isConfigured(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  envVars(): EnvVarStatus[] {
    return [
      { name: "BLOB_READ_WRITE_TOKEN", required: true, configured: !!process.env.BLOB_READ_WRITE_TOKEN },
    ];
  }

  async presign(opts: { folder: StorageFolder; filename: string; contentType: string }): Promise<PresignedUpload> {
    const ext = EXT_FOR_TYPE[opts.contentType] ?? opts.filename.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${this.uploadPrefix()}${opts.folder}/${nanoid(16)}.${ext}`;
    // Vercel Blob: direct upload via @vercel/blob.put() on server. Client POST'lar /api/upload/vercel-blob endpoint'ine.
    return {
      uploadUrl: `/api/upload/vercel-blob?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(opts.contentType)}`,
      key,
      publicUrl: key,
      expiresIn: 3600,
      uploadMethod: "POST",
      forwardToServerEndpoint: "/api/upload/vercel-blob",
    };
  }

  async delete(key: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(key);
  }
}
