/**
 * supabase.service.ts
 * Upload direto mobile → Supabase Storage
 * Compressão obrigatória via expo-image-manipulator (max 1080px, qualidade 0.82)
 */
import { createClient } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET            = 'minha-rede';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type UploadFolder = 'avatars' | 'posts' | 'covers' | 'stories';

async function compressImage(localUri: string) {
  return ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );
}

export async function uploadImage(localUri: string, folder: UploadFolder): Promise<string> {
  // 1. Comprime
  const compressed = await compressImage(localUri);

  // 2. Lê como blob
  const response = await fetch(compressed.uri);
  const blob     = await response.blob();

  // 3. Gera chave única — usa expo-crypto (sem crypto.getRandomValues)
  const randomId = Crypto.randomUUID();
  const key      = `${folder}/${randomId}.jpg`;

  // 4. Upload para Supabase
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(key, blob, {
      contentType: 'image/jpeg',
      upsert:      false,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Upload falhou: ${error.message}`);
  }

  // 5. URL pública permanente
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) throw new Error('URL pública não retornada');

  console.log('✅ Upload OK:', urlData.publicUrl.substring(0, 80));
  return urlData.publicUrl;
}
