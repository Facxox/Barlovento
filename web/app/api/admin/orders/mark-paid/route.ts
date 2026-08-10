import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { processOrderById } from '@/lib/mp-webhook';

/**
 * POST /api/admin/orders/mark-paid
 *
 * Marca una orden como `paid` manualmente. Casos de uso:
 *   - El pago se confirmó en el panel de MP pero el webhook no llegó
 *     (IPN throttling, deploy caído en el momento, etc.).
 *   - Coordinación offline con el cliente (transferencia bancaria,
 *     pago coordinado, etc.) — la orden existe pero nunca pasó por MP.
 *
 * Body: { order_id: number, mp_payment_id?: string, note?: string }
 *
 * Side effects: si la orden tiene un cupón, lo redime igual que el
 * webhook real (idempotente).
 *
 * Requiere sesión admin.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { requireAdminStrict } = await import('@/lib/admin-actions');
  try {
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let body: { order_id?: number; mp_payment_id?: string; note?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderId = Number(body.order_id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'order_id_required' }, { status: 400 });
  }

  const paymentId =
    body.mp_payment_id ??
    `manual-${Date.now()}`;

  // Anotamos el motivo en logs para auditoría.
  console.log('[admin/mark-paid]', {
    orderId,
    paymentId,
    note: body.note ?? null,
    at: new Date().toISOString(),
  });

  const result = await processOrderById(orderId, 'paid', paymentId);
  if (!result) {
    return NextResponse.json(
      { error: 'order_not_found_or_update_failed' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, ...result });
}