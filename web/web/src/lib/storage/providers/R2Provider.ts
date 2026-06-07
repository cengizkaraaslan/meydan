import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { StorageProvider, type PresignedUpload, type StorageFolder, type EnvVarStatus, type ProviderMeta } from "../StorageProvider";

const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
};

export class R2Provider extends StorageProvider {
  readonly meta: ProviderMeta = {
    id: "R2",
    displayName: "Cloudflare R2",
    description: "S3-uyumlu object storage, egress ücretsiz. Default seçim.",
    url: "https://developers.cloudflare.com/r2/",
    freeTier: "10 GB depolama + sınırsız egress",
  };

  private _client: S3Client | null = null;
  private get client(): S3Client {
    if (this._client) return this._client;
    this._client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
    return this._client;
  }

  private get bucket(): string {
    return process.env.R2_BUCKET_NAME ?? "etkinlik";
  }

  isConfigured(): boolean {
    return Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
  }

  envVars(): EnvVarStatus[] {
    return [
      { name: "R2_ENDPOINT",           required: true,  configured: !!process.env.R2_ENDPOINT },
      { name: "R2_ACCESS_KEY_ID",      required: true,  configured: !!process.env.R2_ACCESS_KEY_ID },
      { name: "R2_SECRET_ACCESS_KEY",  required: true,  configured: !!process.env.R2_SECRET_ACCESS_KEY },
      { name: "R2_BUCKET_NAME",        required: false, configured: !!process.env.R2_BUCKET_NAME },
      { name: "R2_PUBLIC_URL",         required: false, configured: !!process.env.R2_PUBLIC_URL },
    ];
  }

  async presign(opts: { folder: StorageFolder; filename: string; contentType: string }): Promise<PresignedUpload> {
    const ext = EXT_FOR_TYPE[opts.contentType] ?? opts.filename.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${this.uploadPrefix()}${opts.folder}/${nanoid(16)}.${ext}`;
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: opts.contentType });
    const expiresIn = 600;
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn });
    const base = process.env.R2_PUBLIC_URL;
    const publicUrl = base ? `${base.replace(/\/$/, "")}/${key}` : key;
    return { uploadUrl, key, publicUrl, expiresIn, uploadMethod: "PUT" };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
