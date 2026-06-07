import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { StorageProvider, type PresignedUpload, type StorageFolder, type EnvVarStatus, type ProviderMeta } from "../StorageProvider";

const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
};

export class S3Provider extends StorageProvider {
  readonly meta: ProviderMeta = {
    id: "S3",
    displayName: "Amazon S3",
    description: "Standart endüstri seçimi. Ücretsiz tier ilk yıl 5 GB.",
    url: "https://aws.amazon.com/s3/",
    freeTier: "İlk 12 ay 5 GB + 20k GET + 2k PUT/ay",
  };

  private _client: S3Client | null = null;
  private get client(): S3Client {
    if (this._client) return this._client;
    this._client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
    return this._client;
  }

  private get bucket(): string {
    return process.env.S3_BUCKET_NAME ?? "etkinlik";
  }

  isConfigured(): boolean {
    return Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME);
  }

  envVars(): EnvVarStatus[] {
    return [
      { name: "S3_ACCESS_KEY_ID",     required: true,  configured: !!process.env.S3_ACCESS_KEY_ID },
      { name: "S3_SECRET_ACCESS_KEY", required: true,  configured: !!process.env.S3_SECRET_ACCESS_KEY },
      { name: "S3_BUCKET_NAME",       required: true,  configured: !!process.env.S3_BUCKET_NAME },
      { name: "S3_REGION",            required: false, configured: !!process.env.S3_REGION },
      { name: "S3_PUBLIC_URL",        required: false, configured: !!process.env.S3_PUBLIC_URL },
    ];
  }

  async presign(opts: { folder: StorageFolder; filename: string; contentType: string }): Promise<PresignedUpload> {
    const ext = EXT_FOR_TYPE[opts.contentType] ?? opts.filename.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${this.uploadPrefix()}${opts.folder}/${nanoid(16)}.${ext}`;
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: opts.contentType });
    const expiresIn = 600;
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn });
    const base = process.env.S3_PUBLIC_URL ?? `https://${this.bucket}.s3.${process.env.S3_REGION ?? "us-east-1"}.amazonaws.com`;
    return { uploadUrl, key, publicUrl: `${base.replace(/\/$/, "")}/${key}`, expiresIn, uploadMethod: "PUT" };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
