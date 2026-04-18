import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

type UploadFolder = 'avatars' | 'posts' | 'covers' | 'stories';

@Injectable()
export class MediaService implements OnModuleInit {
  private minioClient: Minio.Client;
  private bucket: string;
  private useSupabase: boolean;

  private supabaseProjectUrl: string;
  private supabaseServiceKey: string;
  private supabaseBucket: string;

  constructor(private readonly config: ConfigService) {
    const supabaseEndpoint = config.get<string>('SUPABASE_S3_ENDPOINT');
    this.useSupabase = !!supabaseEndpoint;

    if (this.useSupabase) {
      const endpointUrl       = new URL(supabaseEndpoint!);
      const projectId         = endpointUrl.hostname.split('.')[0];
      this.supabaseProjectUrl = `https://${projectId}.supabase.co`;
      this.supabaseServiceKey = config.get('SUPABASE_SERVICE_KEY') || '';
      this.supabaseBucket     = config.get('SUPABASE_S3_BUCKET') || 'minha-rede';
      this.bucket             = this.supabaseBucket;
      console.log(`☁️  Storage: Supabase (${this.supabaseProjectUrl})`);
    } else {
      const endpoint  = config.get('MINIO_ENDPOINT') || 'localhost';
      const port      = parseInt(config.get('MINIO_PORT') || '9000');
      this.bucket     = config.get('MINIO_BUCKET') || 'minha-rede';
      this.minioClient = new Minio.Client({
        endPoint:  endpoint,
        port,
        useSSL:    false,
        accessKey: config.get('MINIO_ACCESS_KEY') || 'minioadmin',
        secretKey: config.get('MINIO_SECRET_KEY') || 'minioadmin',
      });
      console.log(`🗄️  Storage: MinIO (${endpoint}:${port})`);
    }
  }

  async onModuleInit() {
    if (this.useSupabase) return;
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
        const policy = JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect:    'Allow',
            Principal: { AWS: ['*'] },
            Action:    ['s3:GetObject'],
            Resource:  [`arn:aws:s3:::${this.bucket}/*`],
          }],
        });
        await this.minioClient.setBucketPolicy(this.bucket, policy);
        console.log(`✅ Bucket '${this.bucket}' criado`);
      }
    } catch (e) {
      console.warn('⚠️  MinIO não disponível:', e.message);
    }
  }

  async getUploadUrl(folder: UploadFolder, ext: string) {
    const key = `${folder}/${uuidv4()}.${ext}`;

    if (this.useSupabase) {
      const publicUrl = `${this.supabaseProjectUrl}/storage/v1/object/public/${this.supabaseBucket}/${key}`;
      return { uploadUrl: '', publicUrl, key };
    }

    const uploadUrl = await this.minioClient.presignedPutObject(this.bucket, key, 60 * 5);
    const publicUrl = `http://${this.config.get('MINIO_ENDPOINT') || 'localhost'}:${this.config.get('MINIO_PORT') || '9000'}/${this.bucket}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (this.useSupabase) {
      const url = `${this.supabaseProjectUrl}/storage/v1/object/${this.supabaseBucket}/${key}`;

      // Usa axios que aceita Buffer nativamente sem problemas de tipagem
      await axios.post(url, buffer, {
        headers: {
          'Authorization': `Bearer ${this.supabaseServiceKey}`,
          'Content-Type':  mimeType,
          'x-upsert':      'true',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const publicUrl = `${this.supabaseProjectUrl}/storage/v1/object/public/${this.supabaseBucket}/${key}`;
      console.log('✅ Supabase upload OK:', publicUrl.substring(0, 70));
      return publicUrl;
    }

    // MinIO local
    await this.minioClient.putObject(this.bucket, key, buffer, buffer.length, { 'Content-Type': mimeType });
    return `http://${this.config.get('MINIO_ENDPOINT') || 'localhost'}:${this.config.get('MINIO_PORT') || '9000'}/${this.bucket}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    if (this.useSupabase) {
      try {
        await axios.delete(
          `${this.supabaseProjectUrl}/storage/v1/object/${this.supabaseBucket}/${key}`,
          { headers: { 'Authorization': `Bearer ${this.supabaseServiceKey}` } },
        );
      } catch {}
      return;
    }
    try { await this.minioClient.removeObject(this.bucket, key); } catch {}
  }
}
