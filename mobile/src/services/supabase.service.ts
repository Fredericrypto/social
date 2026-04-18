/**
 * supabase.service.ts
 * Upload direto mobile → Supabase Storage
 * Compressão obrigatória via expo-image-manipulator (max 1080px, qualidade 0.82)
 */
import { createClient } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET            = 'minha-rede';

// Singleton do cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // não usamos auth do Supabase — só storage
});

export type UploadFolder = 'avatars' | 'posts' | 'covers' | 'stories';

/**
 * Comprime e redimensiona a imagem antes do upload.
 * - Largura máxima: 1080px (mantém aspect ratio)
 * - Qualidade: 0.82 (bom equilíbrio visual/tamanho)
 * - Formato: JPEG (melhor compressão para fotos)
 */
async function compressImage(localUri: string): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }], // redimensiona para max 1080px de largura
    {
      compress: 0.82,
      format:   ImageManipulator.SaveFormat.JPEG,
    },
  );
  return result;
}

/**
 * Faz upload de uma imagem local diretamente para o Supabase Storage.
 * Comprime ANTES de enviar para economizar o 1GB do bucket.
 *
 * @param localUri  URI local da imagem (câmera ou galeria)
 * @param folder    Pasta no bucket: 'avatars' | 'posts' | 'covers' | 'stories'
 * @returns         URL pública permanente da imagem
 */
export async function uploadImage(localUri: string, folder: UploadFolder): Promise<string> {
  // 1. Comprime a imagem
  const compressed = await compressImage(localUri);

  // 2. Lê o arquivo como blob
  const response = await fetch(compressed.uri);
  const blob     = await response.blob();

  // 3. Gera chave única no bucket
  const key = `${folder}/${uuidv4()}.jpg`;

  // 4. Upload direto para o Supabase Storage
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

  // 5. Retorna URL pública permanente
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) {
    throw new Error('Não foi possível obter URL pública do Supabase');
  }

  console.log('✅ Upload OK:', urlData.publicUrl.substring(0, 80));
  return urlData.publicUrl;
}
