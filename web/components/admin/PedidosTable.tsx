'use client';

import { useState } from 'react';
import type { OrderRow } from '@/lib/orders';

const formatUY = (n: number, currency: string) =>
  new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

export default function PedidosTable({ orders }: { orders: OrderRow[] }) {
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-carbon-line/40 last:border-0 align-top">
                <td className="p-3 font-body text-sm text-bone/60">#{o.id}</td>
                <td className="p-3 font-body text-sm text-bone/80">
                  {new Date(o.created_at).toLocaleString('es-UY', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="p-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                      o.channel === 'mercadopago'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-emerald-500/20 text-emerald-300',
                    ].join(' ')}
                  >
                    {o.channel}
                  </span>
                </td>
                <td className="p-3 font-body text-xs text-bone/80">
                  <ul className="space-y-0.5">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.qty} × {it.name}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="p-3 text-right font-display text-base text-gold">
                  {formatUY(o.total, o.currency)}
                </td>
                <td className="p-3 font-body text-xs uppercase tracking-ultra text-bone/70">
                  {o.status}
                </td>
                <td className="p-3 font-body text-xs text-bone/60">
                  {o.customer_name ?? '—'}
                  {o.customer_phone && <div>{o.customer_phone}</div>}
                  {o.customer_email && <div>{o.customer_email}</div>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center font-body text-sm text-bone/50">
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