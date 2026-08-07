import { NextRequest, NextResponse } from 'next/server';
import { getTrafficMetrics, type AnalyticsPeriod } from '@/lib/analytics';

/**
 * GET /api/admin/metrics?period=7d|30d|90d|all
 *
 * Devuelve Page Views, Visitors únicos, deltas vs período anterior y
 * serie diaria. Sólo accesible por admin (validado vía
 * requireAdminStrict para bypassear RLS).
 */
export async function GET(req: NextRequest) {
  const { requireAdminStrict } = await import('@/lib/admin-actions');
  try {
    await requireAdminStrict();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autorizado.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const periodParam = req.nextUrl.searchParams.get('period') ?? '7d';
  const valid: AnalyticsPeriod[] = ['7d', '30d', '90d', 'all'];
  const period: AnalyticsPeriod = (valid as readonly string[]).includes(
    periodParam
  )
    ? (periodParam as AnalyticsPeriod)
    : '7d';

  const data = await getTrafficMetrics(period);
  return NextResponse.json(data);
}
