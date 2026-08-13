import RetirosTable from '@/components/admin/RetirosTable';
import { listPickupOrders } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export default async function AdminRetirosPage() {
  const orders = await listPickupOrders();
  return <RetirosTable orders={orders} />;
}
