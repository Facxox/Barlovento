import { getServiceSupabase } from '@/lib/supabase-admin';
import { getProducts, getWholesaleProducts } from '@/lib/queries';
import CouponsAdmin, { type PickerProduct } from '@/components/admin/CouponsAdmin';
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
  const [coupons, retail, wholesale] = await Promise.all([
    listCoupons(),
    getProducts(),
    getWholesaleProducts(),
  ]);

  // Mergea retail y mayorista. Si un id aparece en ambos (mismo slug en
  // ambos catálogos) lo marcamos como 'both', si no, según origen.
  const byId = new Map<string, PickerProduct>();
  for (const p of retail) {
    byId.set(p.id, { ...p, audience: 'retail' });
  }
  for (const p of wholesale) {
    const existing = byId.get(p.id);
    if (existing) {
      byId.set(p.id, { ...existing, audience: 'both' });
    } else {
      byId.set(p.id, { ...p, audience: 'wholesale' });
    }
  }
  const products = Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  );

  return <CouponsAdmin initialCoupons={coupons} products={products} />;
}
