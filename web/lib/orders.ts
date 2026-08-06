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