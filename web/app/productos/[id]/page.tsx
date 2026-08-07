import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import ProductoDetalle from '@/components/ProductoDetalle';
import { getCategories } from '@/lib/queries';
import productsJson from '@/data/products.json';
import type { Product } from '@/lib/queries';

type ProductLookup = { product: Product; variant: 'retail' | 'wholesale' };

async function getProductById(id: string): Promise<ProductLookup | null> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    const fromJson = (productsJson as Product[]).find((p) => p.id === id);
    if (!fromJson) return null;
    return { product: fromJson, variant: 'retail' };
  }

  // Buscamos primero en el catálogo retail. Si no está, probamos en
  // mayorista. Así un cliente mayorista puede abrir el detalle del
  // producto clonado (id terminado en `-ws`) sin 404.
  const { data: retail, error: retailError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (retailError) return null;
  if (retail) return { product: retail as Product, variant: 'retail' };

  const { data: wholesale, error: wholesaleError } = await supabase
    .from('wholesale_products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (wholesaleError || !wholesale) return null;
  return { product: wholesale as Product, variant: 'wholesale' };
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const lookup = await getProductById(params.id);
  if (!lookup) return { title: 'Producto · Barlovento' };
  return {
    title: `${lookup.product.name} · Barlovento`,
    description: lookup.product.description,
  };
}

export default async function ProductoPage({
  params,
}: {
  params: { id: string };
}) {
  const lookup = await getProductById(params.id);
  if (!lookup) notFound();
  const categories = await getCategories();
  return (
    <ProductoDetalle
      product={lookup.product}
      categories={categories}
      isWholesale={lookup.variant === 'wholesale'}
    />
  );
}
