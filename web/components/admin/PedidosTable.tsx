'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOrderStatus } from '@/lib/admin-actions';
import type { OrderRow, OrderMetrics } from '@/lib/orders';

const formatUY = (n: number, currency: string) =>
  new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

const STATUS_STYLES: Record<OrderRow['status'], string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  paid: 'bg-emerald-500/20 text-emerald-300',
  fulfilled: 'bg-blue-500/20 text-blue-300',
  cancelled: 'bg-rose-500/20 text-rose-300',
};

const STATUS_LABEL: Record<OrderRow['status'], string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  fulfilled: 'Entregado',
  cancelled: 'Cancelado',
};

export default function PedidosTable({
  orders,
  metrics,
}: {
  orders: OrderRow[];
  metrics: OrderMetrics;
}) {
  const [filter, setFilter] = useState<'all' | OrderRow['channel']>('all');

  const filtered =
    filter === 'all' ? orders : orders.filter((o) => o.channel === filter);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone">Pedidos</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            {orders.length} en total.
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'mercadopago', 'whatsapp'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'rounded-full border px-4 py-1.5 font-body text-xs uppercase tracking-ultra transition',
                filter === f
                  ? 'border-gold bg-gold text-carbon'
                  : 'border-carbon-line text-bone/70 hover:border-bone/50',
              ].join(' ')}
            >
              {f === 'all' ? 'Todos' : f}
            </button>
          ))}
        </div>
      </header>

      <MetricsTiles metrics={metrics} />

      <div className="overflow-x-auto border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="p-3">#</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Canal</th>
              <th className="p-3">Items</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Cliente</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <PedidoRow key={o.id} order={o} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center font-body text-sm text-bone/50">
                  Sin pedidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricsTiles({ metrics }: { metrics: OrderMetrics }) {
  const cards: Array<{ label: string; value: string }> = [];

  for (const [cur, total] of Object.entries(metrics.revenueByCurrency)) {
    cards.push({
      label: `Ingresos (${cur})`,
      value: formatUY(total, cur),
    });
  }
  for (const [cur, total] of Object.entries(metrics.last30RevenueByCurrency)) {
    cards.push({
      label: `Últimos 30d (${cur})`,
      value: formatUY(total, cur),
    });
  }
  for (const [cur, total] of Object.entries(metrics.todayRevenueByCurrency)) {
    cards.push({
      label: `Hoy (${cur})`,
      value: formatUY(total, cur),
    });
  }

  cards.push({ label: 'Pendientes', value: String(metrics.pendingCount) });
  cards.push({ label: 'Pagados', value: String(metrics.paidCount) });
  cards.push({ label: 'Entregados', value: String(metrics.fulfilledCount) });
  cards.push({ label: 'Cancelados', value: String(metrics.cancelledCount) });

  if (cards.length === 0) return null;

  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="border border-carbon-line bg-carbon p-4"
        >
          <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
            {c.label}
          </p>
          <p className="mt-2 font-display text-xl text-gold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function PedidoRow({ order }: { order: OrderRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (status: 'paid' | 'fulfilled' | 'cancelled') => {
    setError(null);
    startTransition(async () => {
      try {
        await setOrderStatus(order.id, status);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
      }
    });
  };

  const canConfirm = order.status === 'pending';
  const canFulfill = order.status === 'paid';
  const canCancel = order.status === 'pending' || order.status === 'paid';

  return (
    <tr className="border-b border-carbon-line/40 last:border-0 align-top">
      <td className="p-3 font-body text-sm text-bone/60">#{order.id}</td>
      <td className="p-3 font-body text-sm text-bone/80">
        {new Date(order.created_at).toLocaleString('es-UY', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
      </td>
      <td className="p-3">
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
            order.channel === 'mercadopago'
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-emerald-500/20 text-emerald-300',
          ].join(' ')}
        >
          {order.channel}
        </span>
      </td>
      <td className="p-3 font-body text-xs text-bone/80">
        <ul className="space-y-0.5">
          {order.items.map((it, i) => (
            <li key={i}>
              {it.qty} × {it.name}
            </li>
          ))}
        </ul>
      </td>
      <td className="p-3 text-right font-display text-base text-gold">
        {formatUY(order.total, order.currency)}
      </td>
      <td className="p-3">
        <span
          className={[
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
            STATUS_STYLES[order.status],
          ].join(' ')}
        >
          {STATUS_LABEL[order.status]}
        </span>
        {error && (
          <p className="mt-1 font-body text-[10px] text-red-400">{error}</p>
        )}
      </td>
      <td className="p-3 font-body text-xs text-bone/60">
        {order.customer_name ?? '—'}
        {order.customer_phone && <div>{order.customer_phone}</div>}
        {order.customer_email && <div>{order.customer_email}</div>}
      </td>
      <td className="p-3">
        <div className="flex flex-wrap justify-end gap-2">
          {canConfirm && (
            <button
              onClick={() => run('paid')}
              disabled={pending}
              className="rounded-full border border-emerald-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-emerald-300 transition hover:bg-emerald-500 hover:text-carbon disabled:opacity-50"
            >
              Confirmar
            </button>
          )}
          {canFulfill && (
            <button
              onClick={() => run('fulfilled')}
              disabled={pending}
              className="rounded-full border border-blue-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-blue-300 transition hover:bg-blue-500 hover:text-carbon disabled:opacity-50"
            >
              Entregar
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => run('cancelled')}
              disabled={pending}
              className="rounded-full border border-rose-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-rose-300 transition hover:bg-rose-500 hover:text-carbon disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          {!canConfirm && !canFulfill && !canCancel && (
            <span className="font-body text-[10px] uppercase tracking-ultra text-bone/30">
              —
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
