import 'server-only';
import { getServerSupabase } from './supabase-server';

export type OrderRow = {
  id: number;
  items: Array<{ id: string; name: string; qty: number; price: number; currency: string }>;
  total: number;
  currency: string;
  channel: 'mercadopago' | 'whatsapp';
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

export type OrderMetrics = {
  revenueByCurrency: Record<string, number>;
  todayRevenueByCurrency: Record<string, number>;
  last30RevenueByCurrency: Record<string, number>;
  paidCount: number;
  pendingCount: number;
  fulfilledCount: number;
  cancelledCount: number;
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
  };

  const supabase = await getServerSupabase();
  if (!supabase) return empty;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data, error } = await supabase
    .from('orders')
    .select('total,currency,status,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
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

    if (isRevenue(row.status)) {
      add(empty.revenueByCurrency, cur, total);
      if (ts >= startOf30d) add(empty.last30RevenueByCurrency, cur, total);
      if (ts >= startOfToday) add(empty.todayRevenueByCurrency, cur, total);
    }
  }

  return empty;
}