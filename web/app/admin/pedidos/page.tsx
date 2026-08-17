import PedidosTable from '@/components/admin/PedidosTable';
import { listOrders } from '@/lib/orders';
import { getProducts } from '@/lib/queries';

export default async function AdminPedidosPage() {
  // Cargamos pedidos y productos en paralelo para poder enriquecer
  // cada item del pedido con los datos vigentes del producto
  // (imagen, badge, descripción, etc.) en el drawer de detalle.
  const [orders, products] = await Promise.all([listOrders(), getProducts()]);

  const productById = Object.fromEntries(
    products.map((p) => [
      p.id,
      {
        image: p.image,
        description: p.description,
        badge: p.badge,
        category: p.category,
        price: p.price,
        currency: p.currency,
        nutrition: p.nutrition,
      },
    ])
  );

  return <PedidosTable orders={orders} productById={productById} />;
}
