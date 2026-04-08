import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: config.get('MINIO_ENDPOINT') || 'localhost',
      port: parseInt(config.get('MINIO_PORT') || '9000'),
      useSSL: false,
      accessKey: config.get('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: config.get('MINIO_SECRET_KEY') || 'minioadmin',
    });
    this.bucket = config.get('MINIO_BUCKET') || 'minha-rede';
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      // Política pública de leitura para imagens
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        }],
      });
      await this.client.setBucketPolicy(this.bucket, policy);
      console.log(`✅ Bucket '${this.bucket}' criado`);
    }
  }

  // Gera URL assinada para upload direto do cliente
  async getUploadUrl(folder: 'avatars' | 'posts' | 'covers', ext: string) {
    const key = `${folder}/${uuidv4()}.${ext}`;
    const url = await this.client.presignedPutObject(this.bucket, key, 60 * 5); // 5 minutos
    const publicUrl = `http://${this.config.get('MINIO_ENDPOINT')}:${this.config.get('MINIO_PORT')}/${this.bucket}/${key}`;
    return { uploadUrl: url, publicUrl, key };
  }

  // Upload direto pelo backend (para casos como avatar vindo do Google)
  async uploadFromUrl(imageUrl: string, folder: string): Promise<string> {
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const key = `${folder}/${uuidv4()}.jpg`;
    await this.client.putObject(this.bucket, key, buffer, buffer.length, { 'Content-Type': 'image/jpeg' });
    return `http://${this.config.get('MINIO_ENDPOINT')}:${this.config.get('MINIO_PORT')}/${this.bucket}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
