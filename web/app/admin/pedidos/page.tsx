import PedidosTable from '@/components/admin/PedidosTable';
import { listOrders, getOrderMetrics } from '@/lib/orders';

export default async function AdminPedidosPage() {
  const [orders, metrics] = await Promise.all([
    listOrders(),
    getOrderMetrics(),
  ]);
  return <PedidosTable orders={orders} metrics={metrics} />;
}
