import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabase();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/admin/login');

    // Defensa en profundidad: middleware ya filtra, pero acá re-chequeamos.
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      redirect('/admin/login?error=no_admin');
    }
  }
  // Si Supabase no está configurado, dejamos pasar para no romper el build en dev.

  return (
    <div className="min-h-screen bg-carbon-raised text-bone">
      <AdminNav />
      <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-10 lg:px-10">{children}</main>
    </div>
  );
}
