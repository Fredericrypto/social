/**
 * supabase.service.ts
 * Upload direto mobile → Supabase Storage
 * Usa base64 — evita URI temporária expirada no Android (imagem preta)
 */
import { createClient } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET            = 'minha-rede';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type UploadFolder = 'avatars' | 'posts' | 'covers' | 'stories';

async function compressImage(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export async function uploadImage(localUri: string, folder: UploadFolder): Promise<string> {
  // 1. Comprime
  const compressedUri = await compressImage(localUri);

  // 2. Lê como base64 via expo-file-system — mais estável que fetch no Android
  const base64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64 || base64.length < 100) {
    throw new Error('Falha ao ler imagem — base64 vazio');
  }

  // 3. Converte base64 para Uint8Array
  const binaryStr = atob(base64);
  const bytes     = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // 4. Gera chave única
  const randomId = Crypto.randomUUID();
  const key      = `${folder}/${randomId}.jpg`;

  // 5. Upload via supabase-js com Uint8Array
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(key, bytes, {
      contentType: 'image/jpeg',
      upsert:      false,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Upload falhou: ${error.message}`);
  }

  // 6. URL pública permanente
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) throw new Error('URL pública não retornada');

  console.log('✅ Upload OK:', urlData.publicUrl.substring(0, 80));
  return urlData.publicUrl;
}
