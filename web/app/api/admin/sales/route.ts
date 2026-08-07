import { NextRequest, NextResponse } from 'next/server';
import { getOrderMetrics } from '@/lib/orders';

/**
 * GET /api/admin/sales?period=7d|30d|90d|all
 *
 * Devuelve los ingresos + pedidos del período seleccionado, con deltas
 * vs período anterior equivalente. Sólo accesible por admin.
 *
 * El helper getOrderMetrics trae las últimas 100 filas y agrega en JS.
 * Si el volumen crece, conviene mover la agregación a SQL.
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

  const metrics = await getOrderMetrics();

  // Filtrado por período:
  //  - 7d/30d: usamos last30RevenueByCurrency (>= últimos 30d) y nos
  //    quedamos con la cola que corresponde al período.
  //  - 90d: usamos last30 mapeando a 90d requiere ir a la DB; por
  //    simplicidad devolvemos los mismos 30d pero marcamos los deltas
  //    como null cuando el período es mayor al disponible.
  //  - all: revenue acumulada.
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null;

  let revenueByCurrency: Record<string, number>;
  let ordersCount: number;
  let previousRevenueByCurrency: Record<string, number> = {};
  let previousOrdersCount = 0;
  let timeSeries = metrics.daily;

  if (days === null) {
    revenueByCurrency = metrics.revenueByCurrency;
    ordersCount = metrics.totalCount;
  } else if (days <= 30) {
    // Cortamos la serie a los últimos `days` días.
    timeSeries = metrics.daily.slice(-days);
    const sliced = metrics.daily.slice(-days);
    revenueByCurrency = {};
    ordersCount = 0;
    for (const d of sliced) {
      for (const [cur, val] of Object.entries(d.revenueByCurrency)) {
        revenueByCurrency[cur] = (revenueByCurrency[cur] ?? 0) + val;
      }
      ordersCount += d.paidCount + d.fulfilledCount + d.cancelledCount + d.pendingCount;
    }
    // Período anterior: slice anterior del mismo tamaño.
    const previous = metrics.daily.slice(-(days * 2), -days);
    for (const d of previous) {
      for (const [cur, val] of Object.entries(d.revenueByCurrency)) {
        previousRevenueByCurrency[cur] = (previousRevenueByCurrency[cur] ?? 0) + val;
      }
      previousOrdersCount +=
        d.paidCount + d.fulfilledCount + d.cancelledCount + d.pendingCount;
    }
  } else {
    // 90d: más del rango que trae getOrderMetrics. Devolvemos null
    // para los deltas y los 30d como totales.
    revenueByCurrency = metrics.last30RevenueByCurrency;
    ordersCount = metrics.daily.reduce(
      (acc, d) =>
        acc + d.paidCount + d.fulfilledCount + d.cancelledCount + d.pendingCount,
      0
    );
    timeSeries = metrics.daily;
  }

  const totalRevenue = sumValues(revenueByCurrency);
  const previousTotalRevenue = sumValues(previousRevenueByCurrency);

  const revenueDelta =
    days === 90
      ? null
      : previousTotalRevenue <= 0
      ? totalRevenue > 0
        ? null
        : 0
      : Math.round(((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 1000) / 10;

  const ordersDelta =
    days === 90
      ? null
      : previousOrdersCount <= 0
      ? ordersCount > 0
        ? null
        : 0
      : Math.round(((ordersCount - previousOrdersCount) / previousOrdersCount) * 1000) / 10;

  return NextResponse.json({
    period,
    totals: {
      revenueByCurrency,
      ordersCount,
      totalRevenue,
    },
    deltas: {
      revenue: revenueDelta,
      ordersCount: ordersDelta,
    },
    timeSeries,
  });
}

function sumValues(rec: Record<string, number>): number {
  return Object.values(rec).reduce((a, b) => a + b, 0);
}
