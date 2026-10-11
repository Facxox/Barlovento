import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * DELETE /api/admin/product-images/[id]
 *
 * Borra una imagen de la galería (DB + storage object).
 * Auth: requiere sesión admin.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const imageId = Number(params.id);
  if (!Number.isFinite(imageId)) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }
  const err = await requireAdmin();
  if (err) return err;

  const service = getServiceSupabase()!;
  const { data: row } = await service
    .from('product_images')
    .select('url, product_id')
    .eq('id', imageId)
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: true });

  const marker = '/storage/v1/object/public/barlovento-media/';
  if (row.url) {
    const idx = row.url.indexOf(marker);
    if (idx !== -1) {
      const path = row.url.slice(idx + marker.length);
      await service.storage.from('barlovento-media').remove([path]);
    }
  }
  const { error } = await service
    .from('product_images')
    .delete()
    .eq('id', imageId);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/admin/product-images/[id]
 *
 * Body: { is_primary: true } — marca la imagen como principal del producto
 * (desmarca el resto en la misma transacción lógica).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const imageId = Number(params.id);
  if (!Number.isFinite(imageId)) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }
  const err = await requireAdmin();
  if (err) return err;

  let body: { is_primary?: boolean } = {};
  try {
    body = (await req.json()) as { is_primary?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (body.is_primary !== true) {
    return NextResponse.json({ ok: false, error: 'noop' }, { status: 400 });
  }

  const service = getServiceSupabase()!;
  const { data: row, error: rErr } = await service
    .from('product_images')
    .select('product_id')
    .eq('id', imageId)
    .maybeSingle();
  if (rErr || !row) {
    return NextResponse.json(
      { ok: false, error: rErr?.message ?? 'not_found' },
      { status: 404 }
    );
  }

  // 1) Clear todas las primary del producto.
  await service
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', row.product_id);
  // 2) Set la nueva.
  const { error } = await service
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/** Auth helper compartido por las acciones de product_images. */
async function requireAdmin(): Promise<NextResponse | null> {
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
  return null;
}
