/**
 * supabase.service.ts
 * Upload direto mobile → Supabase Storage
 * Compressão via expo-image-manipulator + base64 nativo
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

/**
 * Comprime, redimensiona e retorna base64 da imagem.
 * O ImageManipulator com base64:true é o método mais confiável no React Native.
 */
async function compressToBase64(localUri: string, flipHorizontal = false): Promise<string> {
  const actions: ImageManipulator.Action[] = [
    { resize: { width: 1080 } },
  ];

  // Corrige espelhamento da câmera frontal no Android
  if (flipHorizontal) {
    actions.push({ flip: ImageManipulator.FlipType.Horizontal });
  }

  const result = await ImageManipulator.manipulateAsync(
    localUri,
    actions,
    {
      compress: 0.82,
      format:   ImageManipulator.SaveFormat.JPEG,
      base64:   true,  // retorna base64 diretamente — sem depender de URI temporária
    },
  );

  if (!result.base64 || result.base64.length < 100) {
    throw new Error('Compressão falhou — base64 vazio');
  }

  return result.base64;
}

/**
 * Converte base64 string para Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes     = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Faz upload de imagem local diretamente para o Supabase Storage.
 * @param localUri       URI local da imagem
 * @param folder         Pasta no bucket
 * @param flipHorizontal true quando câmera frontal no Android (corrige espelhamento)
 */
export async function uploadImage(
  localUri:       string,
  folder:         UploadFolder,
  flipHorizontal: boolean = false,
): Promise<string> {
  // 1. Comprime e obtém base64
  const base64 = await compressToBase64(localUri, flipHorizontal);

  // 2. Converte para bytes
  const bytes = base64ToBytes(base64);

  // 3. Gera chave única
  const randomId = Crypto.randomUUID();
  const key      = `${folder}/${randomId}.jpg`;

  // 4. Upload via supabase-js
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

  // 5. URL pública permanente
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) throw new Error('URL pública não retornada');

  console.log('✅ Upload OK:', urlData.publicUrl.substring(0, 80));
  return urlData.publicUrl;
}
