import 'server-only';
import { getServerSupabase } from './supabase-server';

const BUCKET = 'barlovento-media';

/**
 * Sube un archivo al bucket público `barlovento-media` y devuelve su URL pública.
 * Usa el client server-side con cookies: el admin autenticado tiene permisos de
 * escritura por la policy "media admin write" definida en 0001_init.sql.
 *
 * Si Supabase no está configurado (dev sin env vars), devuelve la ruta local
 * pasada como fallback (útil para seguir iterando sin setup).
 */
export async function uploadImage(
  file: File,
  pathPrefix: string,
  fallbackLocalPath?: string
): Promise<string> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return fallbackLocalPath ?? '';
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .slice(0, 40);
  const path = `${pathPrefix}/${Date.now()}-${safeName}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Borra un objeto del bucket a partir de su URL pública.
 * Silencioso: si falla no rompe el flujo principal.
 */
export async function deleteImageByUrl(publicUrl: string): Promise<void> {
  const supabase = await getServerSupabase();
  if (!supabase) return;

  // La URL pública tiene formato: .../storage/v1/object/public/barlovento-media/<path>
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}