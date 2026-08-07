import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import ProductosTabs from '@/components/admin/ProductosTabs';
import productsJson from '@/data/products.json';
import type { Product, WholesaleProduct } from '@/lib/queries';

async function listAllProducts(): Promise<Product[]> {
  // El panel admin lee con service-role para evitar que RLS oculte
  // filas. Como fallback (sin env vars), seguimos leyendo del JSON local.
  const supabase = getServiceSupabase();
  if (!supabase) {
    return (productsJson as Product[]).sort(
      (a, b) => a.sort_order - b.sort_order
    );
  }
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as Product[];
}

async function listAllWholesaleProducts(): Promise<WholesaleProduct[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('wholesale_products')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as WholesaleProduct[];
}

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: { type?: string; justCloned?: string };
}) {
  const [retail, wholesale] = await Promise.all([
    listAllProducts(),
    listAllWholesaleProducts(),
  ]);

  const initialTab: 'retail' | 'wholesale' =
    searchParams?.type === 'wholesale' ? 'wholesale' : 'retail';

  return (
    <ProductosTabs
      retail={retail}
      wholesale={wholesale}
      initialTab={initialTab}
      justCloned={searchParams?.justCloned ?? null}
    />
  );
}
