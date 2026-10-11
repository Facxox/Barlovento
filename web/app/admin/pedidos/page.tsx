import PedidosTable from '@/components/admin/PedidosTable';
import type { OrderContainerRow } from '@/components/admin/PedidoDetailDrawer';
import { listOrders } from '@/lib/orders';
import { getProducts } from '@/lib/queries';
import { getServiceSupabase } from '@/lib/supabase-admin';

export default async function AdminPedidosPage() {
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

  // Traemos las composiciones de contenedores persistidas. Necesario
  // para mostrar el desglose "Pedido #1024 — Lata personalizada: 2 ×
  // Alfajor Chocolate, 3 × Alfajor Dulce de Leche" en el drawer.
  const containerCompositionsByOrder: Record<number, OrderContainerRow[]> = {};
  const supabase = getServiceSupabase();
  if (supabase && orders.length > 0) {
    const orderIds = orders.map((o) => o.id);
    const { data, error } = await supabase
      .from('order_container_items')
      .select(
        'order_id, container_item_id, container_product_id, child_product_id, child_name, child_price, child_image, qty'
      )
      .in('order_id', orderIds);
    if (!error && data) {
      for (const row of data as Array<{
        order_id: number;
        container_item_id: string;
        container_product_id: string;
        child_product_id: string;
        child_name: string;
        child_price: number;
        child_image: string | null;
        qty: number;
      }>) {
        const arr = containerCompositionsByOrder[row.order_id] ?? [];
        arr.push({
          container_item_id: row.container_item_id,
          container_product_id: row.container_product_id,
          child_product_id: row.child_product_id,
          child_name: row.child_name,
          child_price: Number(row.child_price),
          child_image: row.child_image,
          qty: Number(row.qty),
        });
        containerCompositionsByOrder[row.order_id] = arr;
      }
    }
  }

  return (
    <PedidosTable
      orders={orders}
      productById={productById}
      containerCompositionsByOrder={containerCompositionsByOrder}
    />
  );
}
