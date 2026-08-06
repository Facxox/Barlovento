import PedidosTable from '@/components/admin/PedidosTable';
import { listOrders } from '@/lib/orders';

export default async function AdminPedidosPage() {
  const orders = await listOrders();
  return <PedidosTable orders={orders} />;
}