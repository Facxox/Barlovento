import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';

/**
 * POST /api/orders/[id]/cancel
 *
 * Marca una orden como 'cancelled'. Sólo funciona si la orden está
 * actualmente en 'pending'. Devuelve 409 si ya fue procesada
 * (paid / fulfilled) o ya estaba cancelada.
 *
 * No requiere auth: el order_id ya es público para el cliente (vuelve
 * en init_point de MP o como query param en /checkout/success). Si en
 * el futuro se quisiera endurecer, agregar match por customer_email
 * enviado en el body sin cambios de UI.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const idNum = Number(params.id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_id' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'db_unavailable' },
      { status: 503 }
    );
  }

  // Leemos primero para conocer channel y mp_preference_id (sólo
  // informativo — la cancelación de preference no es necesaria porque
  // el cliente nunca completó el pago de MP).
  const { data: order, error: readErr } = await supabase
    .from('orders')
    .select('id, status, channel, mp_preference_id')
    .eq('id', idNum)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'read_failed', message: readErr.message },
      { status: 500 }
    );
  }
  if (!order) {
    return NextResponse.json(
      { ok: false, error: 'not_found' },
      { status: 404 }
    );
  }

  if (order.status !== 'pending') {
    return NextResponse.json(
      {
        ok: false,
        error: 'cannot_cancel',
        current_status: order.status,
      },
      { status: 409 }
    );
  }

  // El .eq('status', 'pending') extra evita TOCTOU: si entre el read y
  // el update el webhook de MP marcó la orden como paid, el UPDATE no
  // matchea y devolvemos 409 igual.
  const { data: updated, error: updErr } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', idNum)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: 'update_failed', message: updErr.message },
      { status: 500 }
    );
  }
  if (!updated) {
    // La orden pasó de pending a otro estado entre el read y el update.
    return NextResponse.json(
      { ok: false, error: 'cannot_cancel', current_status: 'unknown' },
      { status: 409 }
    );
  }

  if (order.channel === 'mercadopago' && order.mp_preference_id) {
    // La preference queda activa hasta expirar (~30 días). No genera
    // cobro porque el cliente nunca completó el pago en MP. La SDK
    // instalada no expone cancelación de preference, así que aceptamos
    // el ruido contable.
    console.info(
      'order cancelled by client, mp preference will expire',
      { order_id: idNum, mp_preference_id: order.mp_preference_id }
    );
  }

  return NextResponse.json({
    ok: true,
    order_id: idNum,
    status: 'cancelled',
  });
}
