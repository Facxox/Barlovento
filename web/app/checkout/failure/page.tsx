import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase-admin';
import type { OrderRow } from '@/lib/orders';
import CancelButton from './CancelButton';

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

export default async function CheckoutFailurePage({
  searchParams,
}: {
  searchParams?: SP;
}) {
  const id = readId(searchParams ?? {});
  const order = id ? await fetchOrder(id) : null;
  const canCancel = !!order && order.status === 'pending';

  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-body text-[10px] uppercase tracking-ultra text-red-400">
        Pago no procesado
      </p>
      <h1 className="mt-3 font-display text-4xl text-bone">
        No pudimos completar el pago
      </h1>
      <p className="mt-6 font-body text-base leading-relaxed text-bone/70">
        El pago fue cancelado o rechazado por el medio elegido. Probá de nuevo
        con otra tarjeta o, si preferís, completá tu pedido por WhatsApp.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/productos"
          className="rounded-full bg-gold px-6 py-3 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          Reintentar
        </Link>
        <Link
          href="/"
          className="rounded-full border border-carbon-line px-6 py-3 font-body text-xs uppercase tracking-ultra text-bone/80 transition hover:border-bone/50"
        >
          Volver al sitio
        </Link>
        {canCancel && order && <CancelButton orderId={order.id} />}
      </div>
    </section>
  );
}
