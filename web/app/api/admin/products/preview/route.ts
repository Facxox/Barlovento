import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * POST /api/admin/products/preview
 *
 * Body vacío (o { name?: string }) — crea un producto "vacío" en la DB
 * con un id temporal `tmp_<uuid>` y `is_active = false`. Lo usaremos
 * como ancla para subir fotos de la galería ANTES de que el admin
 * termine de completar el form. Cuando el admin hace el submit final,
 * el server action `upsertProduct` detecta el id `tmp_*` y reemplaza
 * el producto por la versión final (renombrando el id al slug real).
 *
 * Devuelve: { ok: true, productId: string }
 *
 * Si el producto temporal ya tiene imágenes asociadas, se preservan.
 *
 * Auth: admin.
 */
export async function POST(req: NextRequest) {
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

  let body: { name?: string } = {};
  try {
    // body opcional
    body = (await req.json()) as { name?: string };
  } catch {
    /* empty body is fine */
  }

  const tmpId = `tmp_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  const { error } = await service.from('products').insert({
    id: tmpId,
    name: body.name?.slice(0, 200) || 'Producto sin nombre (borrador)',
    description: '',
    price: 0,
    currency: 'UYU',
    category: 'clasicos',
    image: '',
    badge: null,
    is_active: false,
    sort_order: 99999,
    units_per_pack: 1,
    nutrition: null,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, productId: tmpId });
}
