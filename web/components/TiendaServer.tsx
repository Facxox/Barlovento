import { getProducts } from '@/lib/queries';
import Tienda from './Tienda';

export default async function TiendaServer() {
  const products = await getProducts();
  return <Tienda products={products} />;
}
