import 'server-only';
import { getServiceSupabase } from './supabase-admin';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all';

export type AnalyticsDailyPoint = {
  /** YYYY-MM-DD (UTC) */
  date: string;
  visitors: number;
  pageViews: number;
};

export type AnalyticsResult = {
  period: AnalyticsPeriod;
  /** Totales del período actual. */
  totals: {
    visitors: number;
    pageViews: number;
    /** Sólo para métricas de ventas. */
    revenueByCurrency: Record<string, number>;
    ordersCount: number;
  };
  /** Variación porcentual vs el período anterior equivalente. */
  deltas: {
    visitors: number | null;
    pageViews: number | null;
    revenueTotal: number | null;
    ordersCount: number | null;
  };
  /** Serie diaria del período. */
  timeSeries: AnalyticsDailyPoint[];
};

const PERIOD_DAYS: Record<Exclude<AnalyticsPeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function daysFor(p: AnalyticsPeriod): number | null {
  return p === 'all' ? null : PERIOD_DAYS[p];
}

/** yyyy-mm-dd en UTC. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Devuelve los N días previos a `from` (sin incluir `from`). */
function daysBefore(from: Date, n: number): Date[] {
  const out: Date[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d);
  }
  return out;
}

/**
 * Calcula métricas de tráfico para el período dado.
 * - `totals.visitors` = count(distinct visitor_hash)
 * - `totals.pageViews` = count(*)
 * - Las series incluyen un punto por día aunque tenga 0 (para que el
 *   gráfico no tenga huecos).
 */
export async function getTrafficMetrics(
  period: AnalyticsPeriod
): Promise<AnalyticsResult> {
  const emptyVisitorsTs: AnalyticsDailyPoint[] = [];
  if (period !== 'all') {
    const n = daysFor(period)!;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      emptyVisitorsTs.push({ date: isoDay(d), visitors: 0, pageViews: 0 });
    }
  }

  const empty: AnalyticsResult = {
    period,
    totals: { visitors: 0, pageViews: 0, revenueByCurrency: {}, ordersCount: 0 },
    deltas: {
      visitors: null,
      pageViews: null,
      revenueTotal: null,
      ordersCount: null,
    },
    timeSeries: emptyVisitorsTs,
  };

  const service = getServiceSupabase();
  if (!service) return empty;

  const now = new Date();
  if (period === 'all') {
    // Sólo series agrupadas por día (top 365 días para no traer todo).
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - 365);

    const { data: rows } = await service
      .from('visitas')
      .select('fecha_hora,visitor_hash')
      .gte('fecha_hora', since.toISOString());

    if (!rows) return empty;

    const byDay = new Map<string, { v: Set<string>; p: number }>();
    for (const r of rows as Array<{ fecha_hora: string; visitor_hash: string | null }>) {
      const day = isoDay(new Date(r.fecha_hora));
      const bucket = byDay.get(day) ?? { v: new Set(), p: 0 };
      if (r.visitor_hash) bucket.v.add(r.visitor_hash);
      bucket.p += 1;
      byDay.set(day, bucket);
    }
    const ts = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        visitors: b.v.size,
        pageViews: b.p,
      }));
    const allVisitors = new Set<string>();
    let allPV = 0;
    for (const b of byDay.values()) {
      b.v.forEach((h) => allVisitors.add(h));
      allPV += b.p;
    }
    return {
      period,
      totals: {
        visitors: allVisitors.size,
        pageViews: allPV,
        revenueByCurrency: {},
        ordersCount: 0,
      },
      deltas: {
        visitors: null,
        pageViews: null,
        revenueTotal: null,
        ordersCount: null,
      },
      timeSeries: ts,
    };
  }

  const days = daysFor(period)!;
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - days);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);

  const { data: rows } = await service
    .from('visitas')
    .select('fecha_hora,visitor_hash')
    .gte('fecha_hora', previousStart.toISOString());

  const currentVisitors = new Set<string>();
  const previousVisitors = new Set<string>();
  let currentPV = 0;
  let previousPV = 0;
  const byDay = new Map<string, { v: Set<string>; p: number }>();
  for (const day of emptyVisitorsTs) byDay.set(day.date, { v: new Set(), p: 0 });

  for (const r of (rows ?? []) as Array<{
    fecha_hora: string;
    visitor_hash: string | null;
  }>) {
    const t = new Date(r.fecha_hora);
    const day = isoDay(t);
    const bucket = byDay.get(day) ?? { v: new Set(), p: 0 };
    if (r.visitor_hash) bucket.v.add(r.visitor_hash);
    bucket.p += 1;
    byDay.set(day, bucket);
    if (t >= currentStart) {
      currentPV += 1;
      if (r.visitor_hash) currentVisitors.add(r.visitor_hash);
    } else {
      previousPV += 1;
      if (r.visitor_hash) previousVisitors.add(r.visitor_hash);
    }
  }

  const ts = emptyVisitorsTs.map((p) => {
    const b = byDay.get(p.date);
    return {
      date: p.date,
      visitors: b?.v.size ?? 0,
      pageViews: b?.p ?? 0,
    };
  });

  return {
    period,
    totals: {
      visitors: currentVisitors.size,
      pageViews: currentPV,
      revenueByCurrency: {},
      ordersCount: 0,
    },
    deltas: {
      visitors: pct(currentVisitors.size, previousVisitors.size),
      pageViews: pct(currentPV, previousPV),
      revenueTotal: null,
      ordersCount: null,
    },
    timeSeries: ts,
  };
}

function pct(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? null : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}
