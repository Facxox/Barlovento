import ProductoForm from '@/components/admin/ProductoForm';

export default function AdminProductoNuevoPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const isWholesale = searchParams?.type === 'wholesale';
  return (
    <ProductoForm mode="create" variant={isWholesale ? 'wholesale' : 'retail'} />
  );
}
