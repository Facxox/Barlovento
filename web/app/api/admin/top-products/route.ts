import { NextRequest, NextResponse } from 'next/server';
import { getTopProductsByChannel } from '@/lib/orders';

/**
 * GET /api/admin/top-products?period=7d|30d|90d|all
 *
 * Devuelve el ranking de productos más vendidos separado por canal
 * (retail vs wholesale). Sólo accesible por admin.
 */
export async function GET(req: NextRequest) {
  const { requireAdminStrict } = await import('@/lib/admin-actions');
  try {
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const periodParam = req.nextUrl.searchParams.get('period') ?? '30d';
  const valid = ['7d', '30d', '90d', 'all'] as const;
  const period = (valid as readonly string[]).includes(periodParam)
    ? (periodParam as (typeof valid)[number])
    : '30d';

  const data = await getTopProductsByChannel(5, period);
  return NextResponse.json({ period, ...data });
}
