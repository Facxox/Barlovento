import { listUsersWithStats } from '@/lib/admin-queries';
import UsuariosTable from '@/components/admin/UsuariosTable';

export const metadata = { title: 'Usuarios · Barlovento admin' };

export default async function UsuariosPage() {
  const { users, stats } = await listUsersWithStats();
  return <UsuariosTable initial={users} stats={stats} />;
}