import ProductoForm from '@/components/admin/ProductoForm';
import { getCategories } from '@/lib/queries';

export default async function AdminProductoNuevoPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const isWholesale = searchParams?.type === 'wholesale';
  const categories = await getCategories();
  return (
    <ProductoForm
      mode="create"
      variant={isWholesale ? 'wholesale' : 'retail'}
      categories={categories}
    />
  );
}
