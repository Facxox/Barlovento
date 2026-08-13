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
      return ((productsJson as unknown) as Product[]).find(
        (p) => p.id === id
      ) ?? null;
    }
    return null;
  }
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  // Normalizamos `units_per_pack` (la columna nueva puede no venir en
  // filas previas a la migración 0016). Default 1.
  const row = data as Record<string, unknown> & {
    units_per_pack?: number | null;
  };
  return {
    ...(row as unknown as Product | WholesaleProduct),
    units_per_pack:
      typeof row.units_per_pack === 'number' && row.units_per_pack > 0
        ? row.units_per_pack
        : 1,
  };
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
  return (
    <ProductoForm
      mode="edit"
      initial={product}
      variant={isWholesale ? 'wholesale' : 'retail'}
      categories={categories}
    />
  );
}
