import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { getSiteContent } from '@/lib/queries';
import { buildPickupWaLink } from '@/lib/whatsapp-link';
import type { OrderRow } from '@/lib/orders';

type SP = { [k: string]: string | string[] | undefined };

function readId(sp: SP): number | null {
  const v = sp.external_reference ?? sp.order_id;
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function fetchOrder(id: number): Promise<OrderRow | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as OrderRow | null) ?? null;
}

export default async function CheckoutPendingPage({
  searchParams,
}: {
  searchParams?: SP;
}) {
  const id = readId(searchParams ?? {});
  const order = id ? await fetchOrder(id) : null;
  const isPickup = order?.fulfillment === 'pickup';

  const site = await getSiteContent();
  const whatsapp = site?.contacto?.whatsapp ?? '';
  const pickupLink =
    isPickup && order ? buildPickupWaLink(whatsapp, order) : null;

  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
        Pago pendiente
      </p>
      <h1 className="mt-3 font-display text-4xl text-bone">
        Estamos confirmando tu pago
      </h1>

      {isPickup && pickupLink ? (
        <>
          <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
            Cuando el pago se acredite, escribinos por WhatsApp para coordinar
            el retiro de tu pedido.
          </p>
          <p className="mt-2 font-body text-sm text-bone/55">
            Pedido #{order?.id} ·{' '}
            {order?.customer_name ?? 'sin nombre'}
          </p>
          <a
            href={pickupLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-emerald-400"
          >
            Coordiná tu retiro por WhatsApp →
          </a>
        </>
      ) : (
        <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
          Si elegiste un medio que requiere confirmación (por ejemplo, efectivo o
          transferencia), vamos a recibir la acreditación en breve. Te avisamos por
          mail o WhatsApp cuando el pedido quede confirmado.
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-gold px-6 py-3 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          Volver al sitio
        </Link>
        <Link
          href="/productos"
          className="rounded-full border border-carbon-line px-6 py-3 font-body text-xs uppercase tracking-ultra text-bone/80 transition hover:border-bone/50"
        >
          Seguir comprando
        </Link>
      </div>
    </section>
  );
}
