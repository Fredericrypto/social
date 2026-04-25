import { createClient } from "@supabase/supabase-js";
import * as ImageManipulator from "expo-image-manipulator";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/**
 * Todos os buckets de upload do Venus.
 * Para adicionar um novo contexto, basta incluir aqui.
 */
export type UploadFolder =
  | 'avatars'       // fotos de perfil
  | 'posts'         // mídias de posts do feed
  | 'covers'        // fotos de capa do perfil
  | 'stories'       // stories/flashes
  | 'messages'      // fotos trocadas no chat
  | 'vault'         // conteúdo privado / close friends
  | 'highlights'    // capas de destaques de perfil
  | 'media_comments'// fotos em comentários
  | 'verifications' // documentos para verificação de conta
  | 'branding';     // assets de UI dinâmicos

/**
 * Comprime e faz upload de uma imagem para o Supabase Storage.
 * Retorna a URL pública do arquivo.
 *
 * @param localUri  URI local da imagem (expo-image-picker)
 * @param folder    Bucket de destino (UploadFolder)
 * @param quality   Qualidade JPEG 0–1 (padrão 0.8)
 */
export async function uploadImage(
  localUri: string,
  folder: UploadFolder,
  quality = 0.8,
): Promise<string> {
  // Comprimir antes de enviar
  const compressed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1200 } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );

  const response = await fetch(compressed.uri);
  const blob     = await response.blob();
  const ext      = "jpg";
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("minha-rede")
    .upload(fileName, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) throw new Error(`Upload falhou: ${error.message}`);

  const { data } = supabase.storage
    .from("minha-rede")
    .getPublicUrl(fileName);

  return data.publicUrl;
}
