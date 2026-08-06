import { listUsersWithStats } from '@/lib/admin-queries';
import { getServerSupabase } from '@/lib/supabase-server';
import UsuariosTable from '@/components/admin/UsuariosTable';

export const metadata = { title: 'Usuarios · Barlovento admin' };

export default async function UsuariosPage() {
  const { users, stats } = await listUsersWithStats();
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return (
    <UsuariosTable
      initial={users}
      stats={stats}
      currentUserId={user?.id ?? null}
    />
  );
}