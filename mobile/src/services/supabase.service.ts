import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type UploadFolder =
  | "avatars" | "posts" | "covers" | "stories" | "messages"
  | "vault" | "highlights" | "media_comments" | "verifications" | "branding";

/**
 * Upload via fetch + FormData — único método que funciona no Expo Go.
 * FileSystem.uploadAsync falha (módulo nativo não disponível no Go).
 * O Supabase SDK usa fetch internamente mas com headers que o Go bloqueia.
 * Esta implementação usa FormData nativo do RN que não tem esse problema.
 */
export async function uploadImage(
  localUri: string,
  folder: UploadFolder,
  quality = 0.8,
): Promise<string> {
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    name: fileName.split("/").pop()!,
    type: "image/jpeg",
  } as any);

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/minha-rede/${fileName}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "x-upsert": "false",
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.status.toString());
    console.error("[Supabase Upload]", response.status, err);
    throw new Error(`Upload falhou: ${response.status}`);
  }

  const { data } = supabase.storage.from("minha-rede").getPublicUrl(fileName);
  return data.publicUrl;
}
