import ProductoForm from '@/components/admin/ProductoForm';
import { getCategories } from '@/lib/queries';
import { getServerSupabase } from '@/lib/supabase-server';
import productsJson from '@/data/products.json';

export default async function AdminProductoNuevoPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const isWholesale = searchParams?.type === 'wholesale';
  const categories = await getCategories();

  // Total de productos en la tabla correspondiente — define el rango del
  // selector de orden (1..N para crear, N+1 por defecto).
  let total = 0;
  const supabase = await getServerSupabase();
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
      mode="create"
      variant={isWholesale ? 'wholesale' : 'retail'}
      categories={categories}
      totalProducts={total}
    />
  );
}
