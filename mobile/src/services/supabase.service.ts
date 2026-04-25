import { createClient } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type UploadFolder =
  | 'avatars'
  | 'posts'
  | 'covers'
  | 'stories'
  | 'messages'
  | 'vault'
  | 'highlights'
  | 'media_comments'
  | 'verifications'
  | 'branding';

/**
 * Upload via expo-file-system — funciona no Expo Go.
 * O fetch nativo do Supabase SDK falha no Expo Go (Network request failed).
 * FileSystem.uploadAsync usa a implementação nativa do Expo que não tem esse bug.
 */
export async function uploadImage(
  localUri: string,
  folder: UploadFolder,
  quality = 0.8,
): Promise<string> {
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/minha-rede/${fileName}`;

  const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'image/jpeg',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    parameters: {
      cacheControl: '3600',
    },
  });

  if (result.status !== 200 && result.status !== 201) {
    console.error('[Upload Error]', result.status, result.body);
    throw new Error(`Upload falhou: ${result.status}`);
  }

  const { data } = supabase.storage
    .from('minha-rede')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
