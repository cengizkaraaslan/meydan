import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { StorageProvider, type PresignedUpload, type StorageFolder, type EnvVarStatus, type ProviderMeta } from "../StorageProvider";

const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
};

export class BackblazeProvider extends StorageProvider {
  readonly meta: ProviderMeta = {
    id: "BACKBLAZE",
    displayName: "Backblaze B2",
    description: "S3-uyumlu, en ucuz depolama (~0.005$/GB). Cloudflare CDN ile ücretsiz egress.",
    url: "https://www.backblaze.com/b2/",
    freeTier: "10 GB depolama + 1 GB/gün download",
  };

  private _client: S3Client | null = null;
  private get client(): S3Client {
    if (this._client) return this._client;
    this._client = new S3Client({
      region: process.env.B2_REGION ?? "us-west-002",
      endpoint: process.env.B2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID ?? "",
        secretAccessKey: process.env.B2_APPLICATION_KEY ?? "",
      },
    });
    return this._client;
  }

  private get bucket(): string {
    return process.env.B2_BUCKET_NAME ?? "etkinlik";
  }

  isConfigured(): boolean {
    return Boolean(process.env.B2_ENDPOINT && process.env.B2_KEY_ID && process.env.B2_APPLICATION_KEY);
  }

  envVars(): EnvVarStatus[] {
    return [
      { name: "B2_ENDPOINT",         required: true,  configured: !!process.env.B2_ENDPOINT },
      { name: "B2_KEY_ID",           required: true,  configured: !!process.env.B2_KEY_ID },
      { name: "B2_APPLICATION_KEY",  required: true,  configured: !!process.env.B2_APPLICATION_KEY },
      { name: "B2_BUCKET_NAME",      required: false, configured: !!process.env.B2_BUCKET_NAME },
      { name: "B2_REGION",           required: false, configured: !!process.env.B2_REGION },
      { name: "B2_PUBLIC_URL",       required: false, configured: !!process.env.B2_PUBLIC_URL },
    ];
  }

  async presign(opts: { folder: StorageFolder; filename: string; contentType: string }): Promise<PresignedUpload> {
    const ext = EXT_FOR_TYPE[opts.contentType] ?? opts.filename.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${this.uploadPrefix()}${opts.folder}/${nanoid(16)}.${ext}`;
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: opts.contentType });
    const expiresIn = 600;
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn });
    const base = process.env.B2_PUBLIC_URL ?? `${process.env.B2_ENDPOINT}/${this.bucket}`;
    return { uploadUrl, key, publicUrl: `${base.replace(/\/$/, "")}/${key}`, expiresIn, uploadMethod: "PUT" };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
