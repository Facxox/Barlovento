import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import ProductoForm from '@/components/admin/ProductoForm';
import productsJson from '@/data/products.json';
import {
  getCategories,
  getProductImages,
  asContainerConfig,
} from '@/lib/queries';
import type { Product, WholesaleProduct, Category } from '@/lib/queries';
import type { ProductImage } from '@/lib/gallery';
import type { ContainerItemInput } from '@/lib/admin-product-extras';

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

type ProductFormExtras = {
  galleryImages?: ProductImage[];
  containerItems?: ContainerItemInput[];
  availableProducts?: Array<{
    id: string;
    name: string;
    image: string | null;
    can_be_in_container: boolean;
  }>;
};

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
  const categories: Category[] = await getCategories();

  // Sólo retail usa gallery + container extras. Wholesale no las soporta.
  const extras: ProductFormExtras = {};
  if (!isWholesale) {
    const supabase = getServiceSupabase();
    if (supabase) {
      const [images, itemsRes, allProductsRes] = await Promise.all([
        getProductImages(params.id),
        supabase
          .from('product_container_items')
          .select('child_product_id, min_qty, max_qty, sort_order')
          .eq('container_product_id', params.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('products')
          .select('id, name, image, can_be_in_container, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);
      extras.galleryImages = images;
      extras.containerItems = ((itemsRes.data ?? []) as ContainerItemInput[]).map(
        (r) => ({
          child_product_id: r.child_product_id,
          min_qty: r.min_qty ?? 0,
          max_qty: r.max_qty ?? null,
          sort_order: r.sort_order ?? 0,
        })
      );
      extras.availableProducts = (
        (allProductsRes.data ?? []) as Array<{
          id: string;
          name: string;
          image: string | null;
          can_be_in_container: boolean;
        }>
      ).map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image || null,
        can_be_in_container: !!p.can_be_in_container,
      }));
    }
    // Sólo necesitamos los defaults para el ContainerConfigManager si
    // el producto actual no tenía container config.
    void asContainerConfig(product);
  }

  return (
    <ProductoForm
      mode="edit"
      initial={{ ...(product as Product), ...extras } as Product & ProductFormExtras}
      variant={isWholesale ? 'wholesale' : 'retail'}
      categories={categories}
    />
  );
}
