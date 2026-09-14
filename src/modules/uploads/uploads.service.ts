import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

/**
 * Object keys carry a random UUID, so an edited image is always written to a
 * new key and an existing one never changes — safe to cache at the edge and in
 * the browser indefinitely.
 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
};

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  /**
   * Resolved on first use rather than in the constructor, so a missing R2
   * config fails image uploads instead of preventing the API from booting.
   */
  private get storage(): {
    client: S3Client;
    bucket: string;
    publicUrl: string;
  } {
    const accountId = this.config.get<string>('r2.accountId');
    const accessKeyId = this.config.get<string>('r2.accessKeyId');
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey');
    const bucket = this.config.get<string>('r2.bucket');
    const publicUrl = this.config.get<string>('r2.publicUrl');

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicUrl
    ) {
      throw new ServiceUnavailableException(
        'Image storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL.',
      );
    }

    this.client ??= new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    return { client: this.client, bucket, publicUrl };
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
    }

    const { client, bucket, publicUrl } = this.storage;
    const key = `${this.safeFolder(folder)}/${randomUUID()}${this.extensionFor(file)}`;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: CACHE_CONTROL,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to upload ${key} to R2`, error as Error);
      throw new InternalServerErrorException('Failed to upload image.');
    }

    return `${publicUrl}/${key}`;
  }

  async remove(url: string): Promise<void> {
    const { client, bucket, publicUrl } = this.storage;
    const key = this.keyFromUrl(url, publicUrl);

    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      this.logger.error(`Failed to delete ${key} from R2`, error as Error);
      throw new InternalServerErrorException('Failed to delete image.');
    }
  }

  /**
   * Folder segments become part of the object key, so anything outside a
   * conservative allowlist is dropped rather than escaped.
   */
  private safeFolder(folder: string | undefined): string {
    const cleaned = (folder ?? '')
      .split('/')
      .map((segment) => segment.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
      .filter(Boolean)
      .slice(0, 4)
      .join('/');

    return cleaned || 'uploads';
  }

  private extensionFor(file: Express.Multer.File): string {
    const fromMime = EXTENSION_BY_MIME[file.mimetype];
    if (fromMime) return fromMime;

    const fromName = extname(file.originalname).toLowerCase();
    return /^\.[a-z0-9]{1,5}$/.test(fromName) ? fromName : '';
  }

  /** Only objects under this bucket's public URL can be deleted. */
  private keyFromUrl(url: string, publicUrl: string): string {
    const prefix = `${publicUrl}/`;
    if (!url.startsWith(prefix)) {
      throw new BadRequestException('URL does not belong to this bucket.');
    }

    const key = decodeURIComponent(url.slice(prefix.length).split('?')[0]);
    if (!key || key.includes('..')) {
      throw new BadRequestException('Invalid image URL.');
    }

    return key;
  }
}
