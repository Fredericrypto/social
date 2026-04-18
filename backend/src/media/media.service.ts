import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

type UploadFolder = 'avatars' | 'posts' | 'covers' | 'stories';

@Injectable()
export class MediaService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;
  private publicBaseUrl: string;
  private useR2: boolean;

  constructor(private readonly config: ConfigService) {
    const r2AccountId = config.get<string>('R2_ACCOUNT_ID');

    // Usa R2 apenas se R2_ACCOUNT_ID estiver explicitamente configurado
    this.useR2 = !!r2AccountId;
    this.bucket = this.useR2
      ? (config.get('R2_BUCKET') || 'minha-rede')
      : (config.get('MINIO_BUCKET') || 'minha-rede');

    if (this.useR2) {
      this.client = new Minio.Client({
        endPoint: `${r2AccountId}.r2.cloudflarestorage.com`,
        useSSL: true,
        accessKey: config.get('R2_ACCESS_KEY_ID') || '',
        secretKey: config.get('R2_SECRET_ACCESS_KEY') || '',
      });
      this.publicBaseUrl = config.get('R2_PUBLIC_URL') || '';
      console.log('☁️  Storage: Cloudflare R2');
    } else {
      const endpoint = config.get('MINIO_ENDPOINT') || 'localhost';
      const port     = parseInt(config.get('MINIO_PORT') || '9000');
      this.client = new Minio.Client({
        endPoint:  endpoint,
        port,
        useSSL:    false,
        accessKey: config.get('MINIO_ACCESS_KEY') || 'minioadmin',
        secretKey: config.get('MINIO_SECRET_KEY') || 'minioadmin',
      });
      this.publicBaseUrl = `http://${endpoint}:${port}/${this.bucket}`;
      console.log(`🗄️  Storage: MinIO (${endpoint}:${port})`);
    }
  }

  async onModuleInit() {
    if (this.useR2) return; // R2 — bucket gerenciado no dashboard Cloudflare
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        const policy = JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect:    'Allow',
            Principal: { AWS: ['*'] },
            Action:    ['s3:GetObject'],
            Resource:  [`arn:aws:s3:::${this.bucket}/*`],
          }],
        });
        await this.client.setBucketPolicy(this.bucket, policy);
        console.log(`✅ Bucket '${this.bucket}' criado`);
      }
    } catch (e) {
      console.warn('⚠️  MinIO não disponível:', e.message);
    }
  }

  async getUploadUrl(folder: UploadFolder, ext: string) {
    const key       = `${folder}/${uuidv4()}.${ext}`;
    const uploadUrl = await this.client.presignedPutObject(this.bucket, key, 60 * 5);
    const publicUrl = `${this.publicBaseUrl}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  async deleteFile(key: string): Promise<void> {
    try { await this.client.removeObject(this.bucket, key); } catch {}
  }
}
