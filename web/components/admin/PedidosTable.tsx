'use client';

import { useState, useTransition } from 'react';
import type { OrderRow } from '@/lib/orders';

const CURRENCY_SYMBOLS: Record<string, string> = {
  UYU: 'UYU ',
  USD: 'US$ ',
  ARS: 'AR$ ',
  BRL: 'R$ ',
  CLP: 'CLP ',
  MXN: 'MX$ ',
  COP: 'COL$ ',
  PEN: 'S/ ',
};

function formatUY(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const rounded = Math.round(n);
  // Thousand separator manual (es-AR style).
  const withSep = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sym}${withSep}`;
}

type Props = {
  orders: OrderRow[];
};

/**
 * Tabla de pedidos del panel admin.
 *
 * La fecha la recibimos YA formateada del server (string ISO corto)
 * para evitar hydration mismatch: toLocaleString depende del locale
 * del runtime y rompe SSR vs client.
 */
export default function PedidosTable({ orders }: Props) {
  const [filter, setFilter] = useState<
    'all' | OrderRow['channel'] | 'pickup'
  >('all');
  const [items, setItems] = useState<OrderRow[]>(orders);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered =
    filter === 'all'
      ? items
      : filter === 'pickup'
      ? items.filter((o) => o.fulfillment === 'pickup')
      : items.filter((o) => o.channel === filter);

  async function setStatus(
    orderId: number,
    status: 'paid' | 'cancelled' | 'fulfilled' | 'pending'
  ) {
    setBusyId(orderId);
    setError(null);
    try {
      const res = await fetch('/api/admin/orders/mark-paid', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          status,
          note: 'cambiado desde el panel',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        setItems((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status } : o
          )
        );
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function markPaid(orderId: number) {
    await setStatus(orderId, 'paid');
  }

  async function markUnpaid(orderId: number) {
    await setStatus(orderId, 'cancelled');
  }

  async function revertToPending(orderId: number) {
    await setStatus(orderId, 'pending');
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone">Pedidos</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            {items.length} en total.
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'mercadopago', 'whatsapp', 'bank_transfer', 'pickup'] as const).map((f) => (
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
              {f === 'all'
                ? 'Todos'
                : f === 'pickup'
                ? 'Retiro'
                : f === 'bank_transfer'
                ? 'Transferencia'
                : f}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 font-body text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="overflow-x-auto border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="p-3">#</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Canal</th>
              <th className="p-3">Modalidad</th>
              <th className="p-3">Items</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Cliente</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o.id}
                className="border-b border-carbon-line/40 last:border-0 align-top"
              >
                <td className="p-3 font-body text-sm text-bone/60">#{o.id}</td>
                <td className="p-3 font-body text-sm text-bone/80">
                  <FormattedDate iso={o.created_at} />
                </td>
                <td className="p-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                      o.channel === 'mercadopago'
                        ? 'bg-blue-500/20 text-blue-300'
                        : o.channel === 'bank_transfer'
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-emerald-500/20 text-emerald-300',
                    ].join(' ')}
                  >
                    {o.channel === 'bank_transfer' ? 'transferencia' : o.channel}
                  </span>
                  {o.channel === 'bank_transfer' && o.receipt_url && (
                    <a
                      href={o.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-purple-300 transition hover:bg-purple-500 hover:text-carbon"
                      title="Ver comprobante de transferencia"
                    >
                      Comprobante ↗
                    </a>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                      o.fulfillment === 'pickup'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-carbon-line text-bone/60',
                    ].join(' ')}
                  >
                    {o.fulfillment === 'pickup' ? 'Retiro' : 'Envío'}
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
                  <StatusBadge status={o.status} />
                </td>
                <td className="p-3 font-body text-xs text-bone/60">
                  {o.customer_name ?? '—'}
                  {o.customer_phone && <div>{o.customer_phone}</div>}
                  {o.customer_email && <div>{o.customer_email}</div>}
                </td>
                <td className="p-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {o.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => markPaid(o.id)}
                          disabled={busyId === o.id}
                          className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-emerald-300 transition hover:bg-emerald-500 hover:text-carbon disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyId === o.id ? '…' : 'Marcar pagado'}
                        </button>
                        <button
                          type="button"
                          onClick={() => markUnpaid(o.id)}
                          disabled={busyId === o.id}
                          className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-red-300 transition hover:bg-red-500 hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          No pago
                        </button>
                      </>
                    )}
                    {(o.status === 'paid' || o.status === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => revertToPending(o.id)}
                        disabled={busyId === o.id}
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-amber-300 transition hover:bg-amber-500 hover:text-carbon disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Revertir a pendiente
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-12 text-center font-body text-sm text-bone/50"
                >
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

/**
 * Formatea la fecha en cliente usando un format explícito (no locale
 * del browser) para no introducir hydration mismatches.
 * Como fallback si el string es inválido, devuelve el input crudo.
 */
function FormattedDate({ iso }: { iso: string }) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <>{iso}</>;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return <>{`${dd}/${mm}/${yy}, ${hh}:${mi}`}</>;
}

function StatusBadge({ status }: { status: OrderRow['status'] }) {
  const cls =
    status === 'paid'
      ? 'bg-emerald-500/20 text-emerald-300'
      : status === 'cancelled'
      ? 'bg-red-500/20 text-red-300'
      : status === 'fulfilled'
      ? 'bg-blue-500/20 text-blue-300'
      : 'bg-amber-500/20 text-amber-300';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra ${cls}`}
    >
      {status}
    </span>
  );
}