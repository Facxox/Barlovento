import { getProducts, getWholesaleProducts, getCategories, getAllProductImages } from '@/lib/queries';
import { getServerSupabase } from '@/lib/supabase-server';
import Tienda from './Tienda';

export default async function TiendaServer() {
  const supabase = await getServerSupabase();
  let isWholesale = false;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('customer_type')
        .eq('user_id', user.id)
        .maybeSingle();
      isWholesale = profile?.customer_type === 'wholesale';
    }
  }

  const [products, categories, galleryMap] = await Promise.all([
    isWholesale ? getWholesaleProducts() : getProducts(),
    getCategories(),
    getAllProductImages(),
  ]);

  const galleryByProduct: Record<string, import('@/lib/gallery').ProductImage[]> = {};
  if (galleryMap instanceof Map) {
    for (const [k, v] of galleryMap) galleryByProduct[k] = v;
  }

  return (
    <Tienda
      products={products}
      categories={categories}
      galleryByProduct={galleryByProduct}
      isWholesale={isWholesale}
    />
  );
}
