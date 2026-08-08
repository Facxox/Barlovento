import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * Helper de auth para rutas API: a diferencia de los server actions,
 * una API route debe responder con un JSON error en vez de throw.
 */
async function assertAdmin(): Promise<{ ok: true; service: ReturnType<typeof getServiceSupabase> } | { ok: false; status: number; error: string }> {
  const authed = await getServerSupabase();
  if (!authed) return { ok: false, status: 503, error: 'db_unavailable' };

  const { data: { user } } = await authed.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'unauthenticated' };

  const service = getServiceSupabase();
  if (!service) return { ok: false, status: 503, error: 'db_unavailable' };

  const { data: profile } = await service
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.is_admin) return { ok: false, status: 403, error: 'forbidden' };
  return { ok: true, service };
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { data, error } = await auth.service!
    .from('coupons')
    .select('*, rules:coupon_rules(*)')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, coupons: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const supabase = auth.service!;

  const body = await req.json().catch(() => null);
  if (!body?.code || !Array.isArray(body.rules) || body.rules.length === 0) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const { data: coupon, error } = await supabase
    .from('coupons')
    .insert({
      code: body.code.toUpperCase().trim(),
      description: body.description ?? null,
      is_active: body.is_active ?? true,
      starts_at: body.starts_at ?? null,
      ends_at: body.ends_at ?? null,
      min_subtotal: body.min_subtotal ?? null,
      max_discount: body.max_discount ?? null,
      usage_limit: body.usage_limit ?? null,
      per_user_limit: body.per_user_limit ?? null,
      combinable: body.combinable ?? false,
      customer_type: body.customer_type ?? null,
    })
    .select()
    .single();

  if (error || !coupon) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'insert_failed' },
      { status: 500 }
    );
  }

  const rules = body.rules.map((r: any, i: number) => ({
    coupon_id: coupon.id,
    kind: r.kind,
    value: r.value ?? null,
    config: r.config ?? {},
    applies_to: r.applies_to ?? { all: true },
    sort_order: r.sort_order ?? i,
  }));

  const { error: rulesErr } = await supabase.from('coupon_rules').insert(rules);
  if (rulesErr) {
    await supabase.from('coupons').delete().eq('id', coupon.id);
    return NextResponse.json({ ok: false, error: rulesErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, coupon_id: coupon.id });
}

export async function PATCH(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const supabase = auth.service!;

  const body = await req.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const k of [
    'description', 'is_active', 'starts_at', 'ends_at',
    'min_subtotal', 'max_discount', 'usage_limit',
    'per_user_limit', 'combinable', 'customer_type',
  ]) {
    if (k in body) updates[k] = body[k];
  }

  const { error } = await supabase.from('coupons').update(updates).eq('id', body.id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const supabase = auth.service!;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
