import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * POST /api/admin/products/[id]/images/reorder
 *
 * Body: { orderedIds: number[] } — reasigna sort_order por posición.
 * Auth: admin.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;
  if (!productId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }
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

  let body: { orderedIds?: number[] } = {};
  try {
    body = (await req.json()) as { orderedIds?: number[] };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const ids = Array.isArray(body.orderedIds) ? body.orderedIds : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Asignar sort_order = posición (0-based).
  const results = await Promise.all(
    ids.map((id, idx) =>
      service
        .from('product_images')
        .update({ sort_order: idx })
        .eq('id', id)
        .eq('product_id', productId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json(
      { ok: false, error: failed.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
