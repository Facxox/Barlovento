import 'server-only';
import { getServerSupabase } from './supabase-server';

export type OrderRow = {
  id: number;
  items: Array<{ id: string; name: string; qty: number; price: number; currency: string }>;
  total: number;
  currency: string;
  channel: 'mercadopago' | 'whatsapp';
  customer_type: 'retail' | 'wholesale';
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled';
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  mp_payment_id: string | null;
  created_at: string;
};

/**
 * Lista todos los pedidos. Solo accesible por admin autenticado.
 * Si Supabase no está configurado, devuelve [].
 */
export async function listOrders(): Promise<OrderRow[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as OrderRow[];
}

export async function countPendingOrders(): Promise<number> {
  const supabase = await getServerSupabase();
  if (!supabase) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

export type OrderDailyPoint = {
  date: string;
  revenueByCurrency: Record<string, number>;
  ordersCount: number;
  paidCount: number;
  fulfilledCount: number;
  cancelledCount: number;
  pendingCount: number;
};

export type OrderMetrics = {
  revenueByCurrency: Record<string, number>;
  todayRevenueByCurrency: Record<string, number>;
  last30RevenueByCurrency: Record<string, number>;
  paidCount: number;
  pendingCount: number;
  fulfilledCount: number;
  cancelledCount: number;
  totalCount: number;
  /** Serie de los últimos 30 días. */
  daily: OrderDailyPoint[];
};

/**
 * Resumen de pedidos para el panel admin: ingresos por moneda,
 * desglose por estado y desglose por período (hoy, últimos 30 días).
 * Sólo cuenta como ingreso los pedidos en `paid` o `fulfilled`.
 *
 * Agrega en JS sobre las últimas 100 filas. Suficiente para el
 * volumen actual; si crece, pasar a SQL aggregation.
 */
export async function getOrderMetrics(): Promise<OrderMetrics> {
  const empty: OrderMetrics = {
    revenueByCurrency: {},
    todayRevenueByCurrency: {},
    last30RevenueByCurrency: {},
    paidCount: 0,
    pendingCount: 0,
    fulfilledCount: 0,
    cancelledCount: 0,
    totalCount: 0,
    daily: [],
  };

  const supabase = await getServerSupabase();
  if (!supabase) return empty;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data, error } = await supabase
    .from('orders')
    .select('total,currency,status,created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return empty;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const isRevenue = (s: string) => s === 'paid' || s === 'fulfilled';

  const add = (acc: Record<string, number>, cur: string, val: number) => {
    acc[cur] = (acc[cur] ?? 0) + val;
  };

  const isoDay = (d: Date) => d.toISOString().slice(0, 10);

  // Sembramos 30 días vacíos para que la serie no tenga huecos.
  const dailyMap = new Map<string, OrderDailyPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = isoDay(d);
    dailyMap.set(key, {
      date: key,
      revenueByCurrency: {},
      ordersCount: 0,
      paidCount: 0,
      fulfilledCount: 0,
      cancelledCount: 0,
      pendingCount: 0,
    });
  }

  for (const row of data as Array<{
    total: number | string;
    currency: string;
    status: string;
    created_at: string;
  }>) {
    const total = Number(row.total) || 0;
    const cur = row.currency || 'UYU';
    const ts = new Date(row.created_at);

    if (row.status === 'pending') empty.pendingCount += 1;
    else if (row.status === 'paid') empty.paidCount += 1;
    else if (row.status === 'fulfilled') empty.fulfilledCount += 1;
    else if (row.status === 'cancelled') empty.cancelledCount += 1;
    empty.totalCount += 1;

    if (isRevenue(row.status)) {
      add(empty.revenueByCurrency, cur, total);
      if (ts >= startOf30d) add(empty.last30RevenueByCurrency, cur, total);
      if (ts >= startOfToday) add(empty.todayRevenueByCurrency, cur, total);
    }

    const day = isoDay(ts);
    const bucket = dailyMap.get(day);
    if (bucket) {
      bucket.ordersCount += 1;
      if (row.status === 'pending') bucket.pendingCount += 1;
      else if (row.status === 'paid') bucket.paidCount += 1;
      else if (row.status === 'fulfilled') bucket.fulfilledCount += 1;
      else if (row.status === 'cancelled') bucket.cancelledCount += 1;
      if (isRevenue(row.status)) add(bucket.revenueByCurrency, cur, total);
    }
  }

  empty.daily = Array.from(dailyMap.values());
  return empty;
}

export type TopProduct = {
  productId: string | null;
  name: string;
  qty: number;
  revenue: number;
  currency: string;
  ordersCount: number;
};

export type TopProductsByChannel = {
  retail: { items: TopProduct[]; totalQty: number; totalRevenue: number };
  wholesale: { items: TopProduct[]; totalQty: number; totalRevenue: number };
};

/**
 * Ranking de productos más vendidos, separado por canal (retail vs
 * wholesale). Considera únicamente pedidos en estados que cuentan
 * como venta (`paid` o `fulfilled`). Agrupa por `items.id` y nombre
 * del item. Devuelve top N por canal ordenado por unidades vendidas.
 */
export async function getTopProductsByChannel(
  limit = 5,
  period: AnalyticsPeriodLike | null = null
): Promise<TopProductsByChannel> {
  const empty: TopProductsByChannel = {
    retail: { items: [], totalQty: 0, totalRevenue: 0 },
    wholesale: { items: [], totalQty: 0, totalRevenue: 0 },
  };

  const supabase = await getServerSupabase();
  if (!supabase) return empty;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  // Traemos sólo lo necesario para el ranking.
  let query = supabase
    .from('orders')
    .select('items,total,currency,status,created_at,customer_type')
    .in('status', ['paid', 'fulfilled'])
    .order('created_at', { ascending: false });

  if (period) {
    const start = periodStart(period);
    if (start) query = query.gte('created_at', start.toISOString());
  }

  const { data, error } = await query;
  if (error || !data) return empty;

  const buckets: Record<
    'retail' | 'wholesale',
    Map<string, TopProduct>
  > = {
    retail: new Map(),
    wholesale: new Map(),
  };
  const totals: Record<
    'retail' | 'wholesale',
    { qty: number; revenue: number }
  > = {
    retail: { qty: 0, revenue: 0 },
    wholesale: { qty: 0, revenue: 0 },
  };

  type RawOrder = {
    items: Array<{
      id?: string | null;
      name: string;
      qty: number;
      price: number;
      currency?: string;
    }>;
    total: number | string;
    currency: string;
    customer_type: 'retail' | 'wholesale' | null;
  };

  for (const row of data as RawOrder[]) {
    const channel: 'retail' | 'wholesale' =
      row.customer_type === 'wholesale' ? 'wholesale' : 'retail';
    const orderTotal = Number(row.total) || 0;
    const bucket = buckets[channel];
    const total = totals[channel];

    for (const it of row.items ?? []) {
      const qty = Number(it.qty) || 0;
      if (qty <= 0) continue;
      const lineRevenue =
        qty * (Number(it.price) || 0);
      const key = it.id ?? `name:${it.name}`;
      const existing = bucket.get(key);
      if (existing) {
        existing.qty += qty;
        existing.revenue += lineRevenue;
        existing.ordersCount += 1;
      } else {
        bucket.set(key, {
          productId: it.id ?? null,
          name: it.name,
          qty,
          revenue: lineRevenue,
          currency: it.currency ?? row.currency ?? 'UYU',
          ordersCount: 1,
        });
      }
      total.qty += qty;
      total.revenue += lineRevenue;
    }
    // Asegurar que un pedido sin items no descuadre el totalRevenue.
    if ((row.items ?? []).length === 0) {
      total.revenue += orderTotal;
    }
  }

  const finalize = (
    channel: 'retail' | 'wholesale'
  ): TopProductsByChannel[typeof channel] => {
    const items = Array.from(buckets[channel].values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit);
    return {
      items,
      totalQty: totals[channel].qty,
      totalRevenue: totals[channel].revenue,
    };
  };

  return { retail: finalize('retail'), wholesale: finalize('wholesale') };
}

/** Helper: tipo local liviano para evitar importar analytics.ts. */
type AnalyticsPeriodLike = '7d' | '30d' | '90d' | 'all';
function periodStart(p: AnalyticsPeriodLike): Date | null {
  if (p === 'all') return null;
  const days = p === '7d' ? 7 : p === '30d' ? 30 : 90;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}