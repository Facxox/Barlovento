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

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: SP;
}) {
  const id = readId(searchParams ?? {});
  const order = id ? await fetchOrder(id) : null;
  const isPickup = order?.fulfillment === 'pickup';
  const isTransfer = order?.channel === 'bank_transfer';

  const site = await getSiteContent();
  const whatsapp = site?.contacto?.whatsapp ?? '';
  const pickupLink =
    isPickup && order ? buildPickupWaLink(whatsapp, order) : null;

  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
        {isTransfer ? 'Pedido registrado' : 'Pago confirmado'}
      </p>
      <h1 className="mt-3 font-display text-4xl text-bone">
        {isPickup
          ? '¡Listo! Ya coordinamos el retiro'
          : isTransfer
          ? 'Tu pedido quedó registrado'
          : 'Recibimos tu pedido'}
      </h1>

      {isPickup && pickupLink ? (
        <>
          <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
            Tu pago fue acreditado. Para retirar tus alfajores, escribinos por
            WhatsApp y acordamos día, hora y lugar.
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
          <p className="mt-3 font-body text-xs text-bone/50">
            Si el botón no se abre, copiá este link: {pickupLink}
          </p>
        </>
      ) : isTransfer ? (
        <>
          <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
            Guardá tu número de pedido. Cuando veamos la transferencia reflejada
            en nuestra cuenta, te avisamos por email y preparamos el envío
            (o coordinamos el retiro si elegiste esa opción).
          </p>
          <p className="mt-2 font-body text-sm text-bone/55">
            Pedido #{order?.id} · {order?.customer_name ?? 'sin nombre'}
          </p>

          <div className="mt-8 mx-auto max-w-md rounded-2xl border border-gold/30 bg-gold/10 p-6 text-left">
            <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
              Datos para la transferencia
            </p>
            <dl className="mt-4 grid gap-2 font-body text-sm text-bone sm:grid-cols-[auto_1fr]">
              <dt className="text-bone/70">Razón social</dt>
              <dd className="font-medium">Barlovento Uruguay SAS</dd>

              <dt className="text-bone/70">RUT</dt>
              <dd className="font-medium">220411340015</dd>

              <dt className="text-bone/70">Banco</dt>
              <dd className="font-medium">BBVA — Cuentas Corrientes</dd>

              <dt className="text-bone/70">Cuenta (UYU)</dt>
              <dd className="font-medium">26936976</dd>

              <dt className="text-bone/70">Cuenta (USD)</dt>
              <dd className="font-medium">26936976</dd>
            </dl>
            <p className="mt-4 font-body text-xs leading-relaxed text-bone/70">
              Una vez hecha la transferencia, envianos el comprobante por
              WhatsApp o email para acreditar el pedido más rápido.
            </p>
          </div>
        </>
      ) : (
        <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
          En breve nos pondremos en contacto para coordinar la entrega. Guardá tu
          número de pedido — si no te llega un mail de confirmación en los próximos
          minutos, escribinos por WhatsApp.
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
