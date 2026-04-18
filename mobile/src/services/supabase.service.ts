/**
 * supabase.service.ts
 * Upload direto mobile → Supabase Storage
 * Usa FormData com objeto file — único método que funciona no React Native
 * Compressão via expo-image-manipulator antes do upload
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

// Comprime e redimensiona para max 1080px antes do upload
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

  // 2. Gera chave única com expo-crypto
  const randomId = Crypto.randomUUID();
  const key      = `${folder}/${randomId}.jpg`;

  // 3. Monta o objeto file para React Native — não usa fetch/blob
  const fileObject = {
    uri:  compressedUri,
    name: `${randomId}.jpg`,
    type: 'image/jpeg',
  } as unknown as File;

  // 4. Upload direto via supabase-js com objeto file
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(key, fileObject, {
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
