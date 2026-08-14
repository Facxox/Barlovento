import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase-server';
import { listMyOrders, type MyOrder } from '@/lib/profile-actions';
import CuentaForm from './CuentaForm';
import { formatLongDateEs } from '@/components/formatDate';
import { formatMoney } from '@/components/formatMoney';

export const metadata = { title: 'Mi cuenta · Barlovento' };
export const dynamic = 'force-dynamic';

export default async function MiCuentaPage() {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return (
      <div className="grid min-h-screen place-items-center bg-carbon px-6 text-center">
        <p className="font-body text-bone/60">
          Configurá las variables de Supabase para usar tu cuenta.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, phone, address, city, is_admin, customer_type')
    .eq('user_id', user.id)
    .maybeSingle();

  const orders = await listMyOrders();
  const isAdmin = profile?.is_admin === true;
  const isWholesale = profile?.customer_type === 'wholesale';

  return (
    <div className="min-h-screen bg-carbon px-6 py-28 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-eyebrow">Tu cuenta</p>
            <h1 className="mt-3 h-display text-bone">Hola{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h1>
            <p className="mt-2 font-body text-sm text-bone/60">
              {user.email}
            </p>
            <span
              className={[
                'mt-3 inline-block rounded-full px-3 py-1 font-body text-[10px] uppercase tracking-ultra',
                isWholesale
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'border border-carbon-line text-bone/60',
              ].join(' ')}
            >
              {isWholesale ? 'Cliente mayorista' : 'Cliente minorista'}
            </span>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full border border-gold px-4 py-2 font-body text-[11px] uppercase tracking-ultra text-gold hover:bg-gold hover:text-carbon transition"
              >
                Panel admin →
              </Link>
            )}
            <Link
              href="/"
              className="gold-underline font-body text-[11px] uppercase tracking-ultra text-bone/70"
            >
              ← Volver al sitio
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border border-carbon-line bg-carbon-raised p-6 lg:p-8">
          <h2 className="font-display text-xl text-bone">Datos de contacto y envío</h2>
          <p className="mt-1 font-body text-sm text-bone/60">
            Los usamos para enviarte los alfajores y avisarte cuando el pedido sale.
          </p>
          <div className="mt-6">
            <CuentaForm initial={profile ?? undefined} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl text-bone">Mis pedidos</h2>
          <p className="mt-1 font-body text-sm text-bone/60">
            Te avisamos por email cuando se confirman o cambian de estado.
          </p>
          <div className="mt-5">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-carbon-line bg-carbon-raised p-8 text-center">
                <p className="font-display italic text-2xl text-bone/70">Todavía no hiciste pedidos</p>
                <p className="mt-2 font-body text-sm text-bone/50">
                  Probá un clásico y sumá los que quieras desde la tienda.
                </p>
                <Link
                  href="/#tienda"
                  className="mt-5 inline-flex rounded-full border border-gold/40 px-5 py-2.5 font-body text-xs uppercase tracking-ultra text-gold hover:bg-gold hover:text-carbon transition"
                >
                  Ir a la tienda
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: MyOrder }) {
  const items = Array.isArray(order.items) ? order.items : [];
  return (
    <li className="rounded-2xl border border-carbon-line bg-carbon-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-display text-lg text-bone">
          #{order.id}{' '}
          <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-gold">
            {order.channel === 'mercadopago'
              ? 'Mercado Pago'
              : order.channel === 'bank_transfer'
              ? 'Transferencia'
              : 'WhatsApp'}
          </span>
        </div>
        <span className="font-display text-lg text-gold">
          {formatMoney(Number(order.total), order.currency)}
        </span>
      </div>
      <p className="mt-1 font-body text-[11px] uppercase tracking-ultra text-bone/50">
        {formatLongDateEs(order.created_at)} · {order.status}
      </p>
      <ul className="mt-3 space-y-1 font-body text-sm text-bone/75">
        {items.map((it, idx) => (
          <li key={`${order.id}-${idx}`}>
            · {it.qty} x {it.name}
          </li>
        ))}
      </ul>
    </li>
  );
}
