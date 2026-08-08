import 'server-only';
import { getServerSupabase } from './supabase-server';
import { getServiceSupabase } from './supabase-admin';
import type { OrderRow } from './orders';

export type AdminProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  is_admin: boolean;
  customer_type: 'retail' | 'wholesale';
  created_at: string;
  /** Total de pedidos del cliente (cualquier estado). */
  orders_count: number;
  /** Suma de totales de pedidos pagados o cumplidos. */
  total_spent: number;
};

export type UsersStats = {
  total: number;
  wholesale: number;
  retail: number;
  admins: number;
};

export type ListUsersResult = {
  users: AdminProfile[];
  stats: UsersStats;
};

/**
 * Lista todos los perfiles con estadísticas de pedidos.
 * Solo accesible para admins (la auth la garantiza el layout del panel).
 * Si Supabase no está configurado, devuelve listas vacías.
 *
 * Las estadísticas se calculan en JS (no en SQL) para no asumir el shape
 * exacto de `orders` (puede no tener user_id y usar customer_email).
 */
export async function listUsersWithStats(): Promise<ListUsersResult> {
  const empty: ListUsersResult = {
    users: [],
    stats: { total: 0, wholesale: 0, retail: 0, admins: 0 },
  };

  // Lee perfiles con el cliente service-role para evitar que RLS de
  // `profiles` los oculte (la policy admin depende de is_admin(uid) y
  // devuelve 404 cuando la sesión no pasa esa policy).
  const supabase = getServiceSupabase();
  if (!supabase) return empty;

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(
      'user_id, email, full_name, phone, address, city, is_admin, customer_type, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !profiles) return empty;

  // Los pedidos también se leen con service-role para mantener
  // consistencia (el conteo se calcula en JS).
  const orderClient = getServiceSupabase() ?? (await getServerSupabase());
  let orders: { customer_email: string | null; total: number | string; status: string }[] = [];
  let ordersError: unknown = null;
  if (orderClient) {
    const res = await orderClient
      .from('orders')
      .select('customer_email, total, status')
      .limit(2000);
    orders = (res.data ?? []) as typeof orders;
    ordersError = res.error;
  }

  const statsByEmail = new Map<
    string,
    { count: number; totalSpent: number }
  >();

  if (!ordersError && orders) {
    for (const o of orders) {
      const email = (o.customer_email ?? '').toLowerCase().trim();
      if (!email) continue;
      const cur = statsByEmail.get(email) ?? { count: 0, totalSpent: 0 };
      cur.count += 1;
      if (o.status === 'paid' || o.status === 'fulfilled') {
        cur.totalSpent += Number(o.total) || 0;
      }
      statsByEmail.set(email, cur);
    }
  }

  const users: AdminProfile[] = (profiles as any[]).map((p) => {
    const emailKey = (p.email ?? '').toLowerCase().trim();
    const s = statsByEmail.get(emailKey) ?? { count: 0, totalSpent: 0 };
    return {
      user_id: p.user_id,
      email: p.email ?? '',
      full_name: p.full_name ?? null,
      phone: p.phone ?? null,
      address: p.address ?? null,
      city: p.city ?? null,
      is_admin: p.is_admin === true,
      customer_type: p.customer_type === 'wholesale' ? 'wholesale' : 'retail',
      created_at: p.created_at,
      orders_count: s.count,
      total_spent: s.totalSpent,
    };
  });

  const stats: UsersStats = {
    total: users.length,
    wholesale: users.filter((u) => u.customer_type === 'wholesale').length,
    retail: users.filter((u) => u.customer_type === 'retail').length,
    admins: users.filter((u) => u.is_admin).length,
  };

  return { users, stats };
}

/**
 * Conteo de cupones para mostrar en el Resumen.
 * Devuelve { total, active } o null si Supabase no está configurado.
 */
export async function countCoupons(): Promise<{ total: number; active: number } | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { count: total, error: totalErr } = await supabase
    .from('coupons')
    .select('id', { count: 'exact', head: true });
  if (totalErr) return null;
  const { count: active, error: activeErr } = await supabase
    .from('coupons')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (activeErr) return null;
  return { total: total ?? 0, active: active ?? 0 };
}

export async function countUsers(): Promise<number | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    console.error(
      '[countUsers] getServiceSupabase() devolvió null. Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'
    );
    return null;
  }

  const { count, error } = await supabase
    .from('profiles')
    .select('user_id', { count: 'exact', head: true });

  if (error) {
    console.error('[countUsers] Error en la consulta a profiles:', error);
    return null;
  }

  if (count === null || count === undefined) {
    console.error(
      '[countUsers] La consulta a profiles devolvió count=null. Posible problema de parsing o RLS.'
    );
    return null;
  }

  return count;
}
/**
 * Devuelve los pedidos asociados al email de un cliente (case-insensitive).
 * Solo accesible por admin (la auth la verifica el endpoint que la llama).
 * `orders` no tiene FK a `profiles.user_id` — el match se hace por
 * `customer_email`, que es lo que completa el checkout.
 */
export async function getOrdersByCustomerEmail(
  email: string
): Promise<OrderRow[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const normalized = email.toLowerCase().trim();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .ilike('customer_email', normalized)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return data as OrderRow[];
}