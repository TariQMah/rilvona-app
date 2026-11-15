import { createReadStream, mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppError, notFound } from '../common/errors';
import { AppConfig, APP_CONFIG } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { assertUploadAllowed } from './upload-policy';

@Injectable()
export class UploadsService {
  private readonly s3: S3Client | null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.s3 =
      config.storageDriver === 's3' && config.storageBucket && config.storageAccessKey && config.storageSecretKey
        ? new S3Client({
            region: config.storageRegion,
            endpoint: config.storageEndpoint,
            forcePathStyle: config.storageForcePathStyle,
            credentials: { accessKeyId: config.storageAccessKey, secretAccessKey: config.storageSecretKey },
          })
        : null;
  }

  async sign(userId: string, mimeType: string, byteSize: number) {
    const decision = assertUploadAllowed(mimeType, byteSize);
    if (!decision.ok) throw new AppError(400, decision.code, decision.message);
    if (this.config.storageDriver === 's3' && !this.s3) {
      throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Object storage is not configured');
    }
    if (this.config.nodeEnv === 'production' && this.config.storageDriver !== 's3') {
      throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Object storage is not configured');
    }
    const storageKey = `uploads/${userId}/${randomUUID()}`;
    const upload = await this.prisma.mediaUpload.create({
      data: { userId, storageKey, mimeType, byteSize, status: 'PENDING' },
    });
    if (this.config.storageDriver === 'local') {
      return {
        uploadId: upload.id,
        method: 'POST',
        uploadUrl: `/api/v1/uploads/${upload.id}/bytes`,
        headers: { 'content-type': 'application/json' },
      };
    }
    const command = new PutObjectCommand({
      Bucket: this.config.storageBucket,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: byteSize,
    });
    const uploadUrl = await getSignedUrl(this.s3!, command, { expiresIn: 300 });
    return { uploadId: upload.id, method: 'PUT', uploadUrl, headers: { 'content-type': mimeType } };
  }

  async saveLocal(userId: string, uploadId: string, dataBase64: string) {
    if (this.config.storageDriver !== 'local' || this.config.nodeEnv === 'production') {
      throw new AppError(404, 'NOT_FOUND', 'Not found');
    }
    const upload = await this.owned(userId, uploadId);
    const bytes = Buffer.from(dataBase64, 'base64');
    if (bytes.length !== upload.byteSize) {
      throw new AppError(400, 'SIZE_MISMATCH', 'The uploaded file size does not match');
    }
    const path = this.localPath(upload.storageKey);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    await this.prisma.mediaUpload.update({ where: { id: upload.id }, data: { status: 'READY' } });
    return { id: upload.id, status: 'READY', url: this.publicUrl(upload.storageKey) };
  }

  async complete(userId: string, uploadId: string) {
    const upload = await this.owned(userId, uploadId);
    if (this.config.storageDriver === 'local') {
      return { id: upload.id, status: upload.status, url: this.publicUrl(upload.storageKey) };
    }
    await this.prisma.mediaUpload.update({ where: { id: upload.id }, data: { status: 'READY' } });
    return { id: upload.id, status: 'READY', url: this.publicUrl(upload.storageKey) };
  }

  openLocal(storageKey: string) {
    if (!storageKey.startsWith('uploads/') || storageKey.includes('..')) throw notFound();
    return createReadStream(this.localPath(storageKey));
  }

  private async owned(userId: string, uploadId: string) {
    const upload = await this.prisma.mediaUpload.findFirst({ where: { id: uploadId, userId } });
    if (!upload) throw notFound('Upload not found');
    return upload;
  }

  private localPath(storageKey: string) {
    return resolve(this.config.localUploadDir, storageKey);
  }

  private publicUrl(storageKey: string) {
    if (this.config.storagePublicBaseUrl) return `${this.config.storagePublicBaseUrl}/${storageKey}`;
    if (this.config.storageDriver === 'local') return `/api/v1/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
    return null;
  }
}
