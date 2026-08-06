import { getProducts, getCategories } from '@/lib/queries';
import Tienda from './Tienda';

export default async function TiendaServer() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);
  return <Tienda products={products} categories={categories} />;
}
