import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import ProductoDetalle from '@/components/ProductoDetalle';
import { getCategories } from '@/lib/queries';
import productsJson from '@/data/products.json';
import type { Product } from '@/lib/queries';

async function getProductById(id: string): Promise<Product | null> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return (productsJson as Product[]).find((p) => p.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Product;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProductById(params.id);
  if (!product) return { title: 'Producto · Barlovento' };
  return {
    title: `${product.name} · Barlovento`,
    description: product.description,
  };
}

export default async function ProductoPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProductById(params.id);
  if (!product) notFound();
  const categories = await getCategories();
  return <ProductoDetalle product={product} categories={categories} />;
}
