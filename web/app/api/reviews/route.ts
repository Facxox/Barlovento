import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

type Body = {
  rating?: unknown;
  body?: unknown;
};

const MIN_BODY = 10;
const MAX_BODY = 800;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Validación server-side. El cliente también valida, pero no confiamos
  // en él.
  const ratingNum = Number(body.rating);
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ ok: false, error: 'invalid_rating' }, { status: 400 });
  }
  const rating = Math.round(ratingNum) as 1 | 2 | 3 | 4 | 5;

  if (typeof body.body !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const trimmed = body.body.trim();
  if (trimmed.length < MIN_BODY || trimmed.length > MAX_BODY) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body_length' },
      { status: 400 }
    );
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'supabase_not_configured' },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'auth_required' },
      { status: 401 }
    );
  }

  // Chequeamos duplicado antes de insertar para devolver 409 con mensaje
  // claro. La unique index ya lo impediría, pero queremos un error legible.
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // Editar: misma fila, actualizamos rating/body. approved queda como
    // esté (re-moderación queda a criterio del admin).
    const { error: updateError } = await supabase
      .from('reviews')
      .update({ rating, body: trimmed })
      .eq('id', existing.id);
    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, id: existing.id, updated: true });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('reviews')
    .insert({
      user_id: user.id,
      rating,
      body: trimmed,
      approved: true,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === '23505') {
      return NextResponse.json(
        { ok: false, error: 'duplicate' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: insertError?.message ?? 'insert_failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
