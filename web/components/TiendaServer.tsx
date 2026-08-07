import { getProducts, getWholesaleProducts, getCategories } from '@/lib/queries';
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

  const [products, categories] = await Promise.all([
    isWholesale ? getWholesaleProducts() : getProducts(),
    getCategories(),
  ]);

  return (
    <Tienda
      products={products}
      categories={categories}
      isWholesale={isWholesale}
    />
  );
}
