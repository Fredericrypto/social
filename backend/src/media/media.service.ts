import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

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
      return this.getSupabaseUploadUrl(key);
    }

    const uploadUrl = await this.minioClient.presignedPutObject(this.bucket, key, 60 * 5);
    const publicUrl = `http://${this.config.get('MINIO_ENDPOINT') || 'localhost'}:${this.config.get('MINIO_PORT') || '9000'}/${this.bucket}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  private async getSupabaseUploadUrl(key: string) {
    // Supabase exige POST com body JSON {} e Content-Type application/json
    const url = `${this.supabaseProjectUrl}/storage/v1/object/sign/upload/${this.supabaseBucket}/${key}`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.supabaseServiceKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({}), // body vazio mas obrigatório
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Supabase presign error:', response.status, err);
      throw new Error(`Supabase storage error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Supabase presign response:', JSON.stringify(data));

    const signedPath = data.signedURL || data.url || data.signed_url || data.signedUrl;
    if (!signedPath) {
      console.error('Supabase resposta inesperada:', data);
      throw new Error('Supabase não retornou signedURL');
    }

    const uploadUrl = signedPath.startsWith('http')
      ? signedPath
      : `${this.supabaseProjectUrl}${signedPath}`;

    const publicUrl = `${this.supabaseProjectUrl}/storage/v1/object/public/${this.supabaseBucket}/${key}`;

    console.log('✅ Supabase presigned URL OK:', publicUrl.substring(0, 60));
    return { uploadUrl, publicUrl, key };
  }

  async deleteFile(key: string): Promise<void> {
    if (this.useSupabase) {
      try {
        await fetch(
          `${this.supabaseProjectUrl}/storage/v1/object/${this.supabaseBucket}/${key}`,
          { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.supabaseServiceKey}` } }
        );
      } catch {}
      return;
    }
    try { await this.minioClient.removeObject(this.bucket, key); } catch {}
  }
}
