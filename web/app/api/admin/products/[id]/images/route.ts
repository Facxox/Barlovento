import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * POST /api/admin/products/[id]/images
 *
 * Sube una o más imágenes para la galería de un producto.
 *
 * Recibe: multipart/form-data con campos `files` (0..N, blobs) o
 * un único campo `file` (single). Opcional: `alt` o `alts` (string o
 * array paralelo a `files`).
 *
 * Devuelve: { ok: true, rows: ProductImagesRow[] } con las filas recién
 * insertadas (incluyendo id, url, alt, sort_order, is_primary).
 *
 * Seguridad:
 *   - Verifica sesión autenticada (admin) leyendo auth.getUser()
 *   - Verifica is_admin en la tabla profiles (defensa en profundidad)
 *   - Storage bucket "barlovento-media" debe ser público y admin-write
 *     (las policies ya están en 0001_init.sql).
 *   - Tabla product_images RLS: admin authenticated write
 *     (policy "product_images admin write" en 0018_product_images.sql).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;
  if (!productId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  // 1) Verificamos auth y admin role.
  const authed = await getServerSupabase();
  if (!authed) {
    return NextResponse.json(
      { ok: false, error: 'db_unavailable' },
      { status: 503 }
    );
  }
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: 'db_unavailable' },
      { status: 503 }
    );
  }
  const { data: profile } = await service
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // 2) Leemos el multipart.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_formdata' },
      { status: 400 }
    );
  }

  // Aceptamos tanto `files` (múltiple) como `file` (single, fallback).
  const allFiles = form
    .getAll('files')
    .filter((v): v is File => v instanceof File);
  const single = form.get('file');
  const files: File[] = [
    ...allFiles,
    ...(single instanceof File ? [single] : []),
  ];
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_files' }, { status: 400 });
  }

  const altsAll = form
    .getAll('alts')
    .map((v) => (typeof v === 'string' ? v : ''));
  const altSingle = form.get('alt');
  const altHint =
    typeof altSingle === 'string' && altSingle.length > 0 ? altSingle : null;
  function altFor(i: number): string | null {
    const v = altsAll[i];
    if (typeof v === 'string' && v.length > 0) return v;
    return altHint;
  }

  // 3) Verificamos que el producto exista y si ya tiene imagen principal.
  const { data: existing } = await service
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 });
  }
  const { data: existingPrimary } = await service
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .eq('is_primary', true)
    .maybeSingle();

  // 4) Próximo sort_order.
  const { data: last } = await service
    .from('product_images')
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  let next = (Number(last?.sort_order ?? -1)) + 1;

  type Row = {
    id: number;
    url: string;
    alt: string | null;
    sort_order: number;
    is_primary: boolean;
  };
  const inserted: Row[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File) || file.size === 0) continue;

    const ext = (file.name.split('.').pop() ?? '').toLowerCase() || 'jpg';
    const safeName = file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .slice(0, 40);
    const path = `products/${productId}/${Date.now()}-${i}-${safeName}.${ext}`;

    const up = await service.storage
      .from('barlovento-media')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `image/${ext}`,
      });
    if (up.error) {
      return NextResponse.json(
        { ok: false, error: `upload_failed:${up.error.message}` },
        { status: 500 }
      );
    }

    const { data: pub } = service.storage
      .from('barlovento-media')
      .getPublicUrl(path);

    const isPrimary = !existingPrimary && i === 0;
    const { data: ins, error: insErr } = await service
      .from('product_images')
      .insert({
        product_id: productId,
        url: pub.publicUrl,
        alt: altFor(i),
        sort_order: next++,
        is_primary: isPrimary,
      })
      .select('id, url, alt, sort_order, is_primary')
      .single();
    if (insErr || !ins) {
      return NextResponse.json(
        {
          ok: false,
          error: `insert_failed:${insErr?.message ?? 'no_row'}`,
        },
        { status: 500 }
      );
    }
    inserted.push(ins as Row);
  }

  return NextResponse.json({ ok: true, rows: inserted });
}
