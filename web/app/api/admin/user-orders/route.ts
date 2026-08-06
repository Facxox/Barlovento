import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getOrdersByCustomerEmail } from '@/lib/admin-queries';

/**
 * GET /api/admin/user-orders?email=...
 *
 * Devuelve los pedidos asociados al email de un cliente.
 * Protegido: solo accesible para admins autenticados.
 * Si el usuario no es admin → 403.
 */
export async function GET(req: Request) {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'supabase_not_configured' },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get('email') ?? '';
  if (!email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const orders = await getOrdersByCustomerEmail(email);
  return NextResponse.json({ orders });
}
