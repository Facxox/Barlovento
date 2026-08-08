import { getServiceSupabase } from '@/lib/supabase-admin';
import { getProducts } from '@/lib/queries';
import CouponsAdmin from '@/components/admin/CouponsAdmin';
import type { Coupon } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

async function listCoupons(): Promise<Coupon[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('coupons')
    .select('*, rules:coupon_rules(*)')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Coupon[];
}

export default async function AdminCuponesPage() {
  const [coupons, products] = await Promise.all([listCoupons(), getProducts()]);
  return <CouponsAdmin initialCoupons={coupons} products={products} />;
}
