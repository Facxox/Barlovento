import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { processOrderById } from '@/lib/mp-webhook';

/**
 * POST /api/admin/simulate-payment
 *
 * Simula el resultado de un pago de MercadoPago sin pasar por MP.
 * Útil mientras las credenciales de MP estén en sandbox o mientras se
 * valida el flujo de orden/cupón end-to-end.
 *
 * Body: { order_id: number, status: 'approved'|'rejected'|'cancelled', payment_id?: string }
 *
 * Sólo habilitado si ENABLE_MP_SIMULATOR === '1' en el env. Esto evita
 * que quede accesible en producción por accidente.
 *
 * Requiere sesión admin.
 */

export const runtime = 'nodejs';

const VALID_STATUS = ['approved', 'rejected', 'cancelled'] as const;
type SimStatus = (typeof VALID_STATUS)[number];

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_MP_SIMULATOR !== '1') {
    return NextResponse.json(
      { error: 'Simulador deshabilitado. Set ENABLE_MP_SIMULATOR=1 para habilitar.' },
      { status: 404 }
    );
  }

  const { requireAdminStrict } = await import('@/lib/admin-actions');
  try {
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let body: { order_id?: number; status?: string; payment_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderId = Number(body.order_id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'order_id_required' }, { status: 400 });
  }

  const status = String(body.status ?? '').toLowerCase();
  if (!VALID_STATUS.includes(status as SimStatus)) {
    return NextResponse.json(
      { error: 'invalid_status', allowed: VALID_STATUS },
      { status: 400 }
    );
  }

  // approved → 'paid', rejected/cancelled → 'cancelled'
  const nextStatus: 'paid' | 'cancelled' =
    status === 'approved' ? 'paid' : 'cancelled';

  const result = await processOrderById(
    orderId,
    nextStatus,
    body.payment_id ?? `simulated-${Date.now()}`
  );

  if (!result) {
    return NextResponse.json({ error: 'order_not_found_or_update_failed' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({
    enabled: process.env.ENABLE_MP_SIMULATOR === '1',
    usage: 'POST { order_id, status: approved|rejected|cancelled, payment_id? }',
  });
}