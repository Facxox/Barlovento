/**
 * Helpers para servir URLs optimizadas de comprobantes desde Supabase
 * Storage usando Image Transforms (CDN de Supabase).
 *
 * - Thumbnail chico (160px, webp q=70): inline en admin.
 * - Full size (1600px, webp q=85): link "ver comprobante".
 * - Si Image Transforms no está habilitado en el proyecto, devuelve la
 *   URL original (fallback silencioso).
 *
 * Requisito: activar Image Transformations en
 *   Supabase Dashboard → Storage → Settings.
 * Si no está activo, las URLs /render/image/ devuelven 400 y el cliente
 * usa la URL original (que también devolvemos acá como fallback).
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const BUCKET = 'transfer-receipts';

export type ThumbSize = 80 | 160 | 400;

function buildRenderUrl(path: string, params: {
  width?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg';
}): string {
  const qs = new URLSearchParams();
  if (params.width) qs.set('width', String(params.width));
  if (params.quality) qs.set('quality', String(params.quality));
  if (params.format) qs.set('format', params.format);
  return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${path}?${qs}`;
}

/**
 * Extrae "pending/abc.webp" de una URL pública de Supabase Storage.
 * Devuelve null si la URL no es de este bucket.
 */
function pathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(
      new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`)
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Detecta si la URL (o el path) apunta a un PDF.
 * Image Transforms de Supabase no soporta PDFs, así que para esos
 * devolvemos la URL original sin transformar.
 */
function isPdf(url: string, path: string | null): boolean {
  const check = path ?? url;
  return /\.pdf(\?|$)/i.test(check);
}

function safeTransform(
  receiptUrl: string,
  params: Parameters<typeof buildRenderUrl>[1]
): string {
  if (!SUPABASE_URL) return receiptUrl;
  const path = pathFromPublicUrl(receiptUrl);
  if (!path) return receiptUrl;
  if (isPdf(receiptUrl, path)) return receiptUrl;
  return buildRenderUrl(path, params);
}

export function receiptThumbUrl(
  receiptUrl: string | null,
  size: ThumbSize = 160
): string | null {
  if (!receiptUrl) return null;
  return safeTransform(receiptUrl, {
    width: size,
    quality: 70,
    format: 'webp',
  });
}

export function receiptFullUrl(receiptUrl: string | null): string | null {
  if (!receiptUrl) return null;
  return safeTransform(receiptUrl, {
    width: 1600,
    quality: 85,
    format: 'webp',
  });
}
