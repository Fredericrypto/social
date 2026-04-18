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
  private useSupabase: boolean;

  constructor(private readonly config: ConfigService) {
    const supabaseEndpoint = config.get<string>('SUPABASE_S3_ENDPOINT');

    // Usa Supabase S3 se a variável estiver configurada
    this.useSupabase = !!supabaseEndpoint;

    if (this.useSupabase) {
      // Supabase S3 — endpoint no formato https://xxx.storage.supabase.co/storage/v1/s3
      const endpointUrl = new URL(supabaseEndpoint!);
      this.bucket = config.get('SUPABASE_S3_BUCKET') || 'minha-rede';

      this.client = new Minio.Client({
        endPoint:  endpointUrl.hostname,
        port:      443,
        useSSL:    true,
        pathStyle: true,
        accessKey: config.get('SUPABASE_S3_ACCESS_KEY') || '',
        secretKey: config.get('SUPABASE_S3_SECRET_KEY') || '',
        region:    config.get('SUPABASE_S3_REGION') || 'us-east-1',
      });

      // URL pública do Supabase Storage
      // formato: https://[project].supabase.co/storage/v1/object/public/[bucket]/[key]
      const projectId = endpointUrl.hostname.split('.')[0];
      this.publicBaseUrl = `https://${projectId}.supabase.co/storage/v1/object/public/${this.bucket}`;

      console.log('☁️  Storage: Supabase S3');
    } else {
      // MinIO local para desenvolvimento
      const endpoint = config.get('MINIO_ENDPOINT') || 'localhost';
      const port     = parseInt(config.get('MINIO_PORT') || '9000');
      this.bucket    = config.get('MINIO_BUCKET') || 'minha-rede';

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
    if (this.useSupabase) return; // Supabase — bucket gerenciado no dashboard
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
    const key = `${folder}/${uuidv4()}.${ext}`;

    if (this.useSupabase) {
      // Supabase S3 — presigned PUT via MinIO SDK com path completo
      const supabaseEndpoint = this.config.get<string>('SUPABASE_S3_ENDPOINT')!;
      const fullPath = `${this.bucket}/${key}`;
      const uploadUrl = await this.client.presignedPutObject(this.bucket, key, 60 * 5);
      const publicUrl = `${this.publicBaseUrl}/${key}`;
      return { uploadUrl, publicUrl, key };
    }

    const uploadUrl = await this.client.presignedPutObject(this.bucket, key, 60 * 5);
    const publicUrl = `${this.publicBaseUrl}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  async deleteFile(key: string): Promise<void> {
    try { await this.client.removeObject(this.bucket, key); } catch {}
  }
}
