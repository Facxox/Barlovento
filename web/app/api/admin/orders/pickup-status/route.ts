import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { PICKUP_STATUSES, updatePickupStatus } from '@/lib/orders';

/**
 * POST /api/admin/orders/pickup-status
 *
 * Cambia el `pickup_status` de una orden con retiro. Acepta sólo
 * valores de PICKUP_STATUSES:
 *   - awaiting_coordination → coordinated | delivered | cancelled
 *   - coordinated           → delivered | cancelled
 *   - delivered             → (estado final, sin transición)
 *   - cancelled             → (estado final, sin transición)
 *
 * Body: { order_id: number, pickup_status: PickupStatus }
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

  let body: { order_id?: number; pickup_status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderId = Number(body.order_id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'order_id_required' }, { status: 400 });
  }

  const requested = String(body.pickup_status ?? '');
  if (!(PICKUP_STATUSES as readonly string[]).includes(requested)) {
    return NextResponse.json(
      { error: 'invalid_pickup_status', allowed: PICKUP_STATUSES },
      { status: 400 }
    );
  }

  const result = await updatePickupStatus(
    orderId,
    requested as (typeof PICKUP_STATUSES)[number]
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  console.log('[admin/orders/pickup-status]', {
    orderId,
    pickup_status: requested,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
