'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from './supabase-server';

export type ProfileInput = {
  full_name: string;
  phone: string;
  address: string;
  city: string;
};

export async function updateProfile(input: ProfileInput): Promise<void> {
  const supabase = await getServerSupabase();
  if (!supabase) throw new Error('Supabase no configurado.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado.');

  // Si el perfil no existe todavía (no se creó en el signup), lo insertamos
  // primero con upsert. Sin esto, el UPDATE no encuentra la fila y "guarda"
  // en el vacío sin error.
  const payload = {
    user_id: user.id,
    email: user.email ?? null,
    full_name: input.full_name.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw new Error(`updateProfile: ${error.message}`);

  revalidatePath('/mi-cuenta');
}

export type MyOrder = {
  id: number;
  items: Array<{ id?: string; name: string; qty: number; price: number }>;
  total: number;
  currency: string;
  channel: 'mercadopago' | 'whatsapp';
  status: string;
  created_at: string;
};

export async function listMyOrders(): Promise<MyOrder[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('id, items, total, currency, channel, status, created_at')
    .eq('customer_email', user.email)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return (data ?? []) as MyOrder[];
}
