import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { processOrderById } from '@/lib/mp-webhook';

/**
 * POST /api/admin/orders/mark-paid
 *
 * Cambia manualmente el estado de una orden. Acepta:
 *   - status: 'paid'      → confirma cobro
 *   - status: 'cancelled' → marca como cancelada / no pago
 *   - status: 'fulfilled' → entregada
 *   - status: 'pending'   → revertir a pendiente (sólo desde paid/cancelled)
 *
 * Body: { order_id: number, status: 'paid'|'cancelled'|'fulfilled'|'pending',
 *         mp_payment_id?: string, note?: string }
 *
 * Side effects: si la orden pasa a `paid` y tiene un cupón, lo redime
 * igual que el webhook real (idempotente). Si pasa de `paid` a
 * `cancelled`, se marca la redención como refunded (rollback del cupón).
 *
 * Requiere sesión admin.
 */

export const runtime = 'nodejs';

type AdminStatus = 'paid' | 'cancelled' | 'fulfilled' | 'pending';
const ALLOWED: readonly AdminStatus[] = ['paid', 'cancelled', 'fulfilled', 'pending'];

export async function POST(req: NextRequest) {
  const { requireAdminStrict } = await import('@/lib/admin-actions');
  try {
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let body: {
    order_id?: number;
    status?: string;
    mp_payment_id?: string;
    note?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderId = Number(body.order_id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'order_id_required' }, { status: 400 });
  }

  const requested = String(body.status ?? '').toLowerCase();
  if (!ALLOWED.includes(requested as AdminStatus)) {
    return NextResponse.json(
      { error: 'invalid_status', allowed: ALLOWED },
      { status: 400 }
    );
  }
  const nextStatus = requested as AdminStatus;

  const paymentId =
    body.mp_payment_id ?? (nextStatus === 'paid' ? `manual-${Date.now()}` : null);

  // Anotamos el motivo en logs para auditoría.
  console.log('[admin/orders/set-status]', {
    orderId,
    nextStatus,
    paymentId,
    note: body.note ?? null,
    at: new Date().toISOString(),
  });

  // Si estamos saliendo de paid → necesitamos revertir el cupón.
  if (nextStatus !== 'paid') {
    try {
      const { refundRedemption } = await import('@/lib/coupons');
      const { getServiceSupabase } = await import('@/lib/supabase-admin');
      const supabase = getServiceSupabase();
      if (supabase) {
        await refundRedemption(supabase, orderId);
      }
    } catch (e) {
      // No bloqueamos — el cupón se puede revertir manualmente.
      console.error('refund redemption failed', e);
    }
  }

  const result = await processOrderById(orderId, nextStatus, paymentId);
  if (!result) {
    return NextResponse.json(
      { error: 'order_not_found_or_update_failed' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, ...result });
}