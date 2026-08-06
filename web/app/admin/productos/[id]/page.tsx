import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import ProductoForm from '@/components/admin/ProductoForm';
import productsJson from '@/data/products.json';
import { getCategories } from '@/lib/queries';
import type { Product, WholesaleProduct } from '@/lib/queries';

async function getProduct(
  id: string,
  table: 'products' | 'wholesale_products'
): Promise<Product | WholesaleProduct | null> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    if (table === 'products') {
      return (productsJson as Product[]).find((p) => p.id === id) ?? null;
    }
    return null;
  }
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return (data as Product | WholesaleProduct) ?? null;
}

export default async function AdminProductoEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { type?: string };
}) {
  const isWholesale = searchParams?.type === 'wholesale';
  const product = await getProduct(
    params.id,
    isWholesale ? 'wholesale_products' : 'products'
  );
  if (!product) notFound();
  const categories = await getCategories();

  let total = 0;
  if (supabase) {
    const table = isWholesale ? 'wholesale_products' : 'products';
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });
    total = count ?? 0;
  } else {
    total = productsJson.length;
  }

  return (
    <ProductoForm
      mode="edit"
      initial={product}
      variant={isWholesale ? 'wholesale' : 'retail'}
      categories={categories}
      totalProducts={total}
    />
  );
}
