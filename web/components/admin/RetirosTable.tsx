'use client';

import { useState, useTransition } from 'react';
import type { OrderRow, PickupStatus } from '@/lib/orders';

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
  const withSep = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sym}${withSep}`;
}

type Props = {
  orders: OrderRow[];
};

export default function RetirosTable({ orders }: Props) {
  const [items, setItems] = useState<OrderRow[]>(orders);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function setStatus(orderId: number, status: PickupStatus) {
    setBusyId(orderId);
    setError(null);
    try {
      const res = await fetch('/api/admin/orders/pickup-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, pickup_status: status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => {
        setItems((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, pickup_status: status } : o
          )
        );
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone">Retiros</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            Pedidos pagados por Mercado Pago con retiro coordinado por WhatsApp.
          </p>
          <p className="mt-1 font-body text-sm text-bone/60">
            {items.length} en total.
          </p>
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
              <th className="p-3">Cliente</th>
              <th className="p-3">Items</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Estado pedido</th>
              <th className="p-3">Coordinación</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr
                key={o.id}
                className="border-b border-carbon-line/40 last:border-0 align-top"
              >
                <td className="p-3 font-body text-sm text-bone/60">#{o.id}</td>
                <td className="p-3 font-body text-sm text-bone/80">
                  <FormattedDate iso={o.created_at} />
                </td>
                <td className="p-3 font-body text-xs text-bone/70">
                  <div className="text-bone">{o.customer_name ?? '—'}</div>
                  {o.customer_phone && <div>{o.customer_phone}</div>}
                  {o.customer_email && <div>{o.customer_email}</div>}
                  {o.customer_notes && (
                    <div className="mt-1 italic text-bone/55">
                      “{o.customer_notes}”
                    </div>
                  )}
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
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="p-3 font-body text-xs uppercase tracking-ultra">
                  <PickupStatusBadge status={o.pickup_status} />
                </td>
                <td className="p-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {(o.pickup_status === 'awaiting_coordination' ||
                      o.pickup_status === null) &&
                      o.status !== 'cancelled' && (
                        <>
                          <PickupButton
                            busy={busyId === o.id}
                            onClick={() => setStatus(o.id, 'coordinated')}
                            color="emerald"
                            label="Marcar coordinado"
                          />
                          <PickupButton
                            busy={busyId === o.id}
                            onClick={() => setStatus(o.id, 'cancelled')}
                            color="red"
                            label="Cancelar"
                          />
                        </>
                      )}
                    {o.pickup_status === 'coordinated' && (
                      <PickupButton
                        busy={busyId === o.id}
                        onClick={() => setStatus(o.id, 'delivered')}
                        color="gold"
                        label="Marcar entregado"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-12 text-center font-body text-sm text-bone/50"
                >
                  No hay retiros pendientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PickupButton({
  busy,
  onClick,
  color,
  label,
}: {
  busy: boolean;
  onClick: () => void;
  color: 'emerald' | 'red' | 'gold';
  label: string;
}) {
  const cls =
    color === 'emerald'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-carbon'
      : color === 'red'
      ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-cream'
      : 'border-gold/50 bg-gold/10 text-gold hover:bg-gold hover:text-carbon';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-full border px-3 py-1 font-body text-[10px] uppercase tracking-ultra transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {busy ? '…' : label}
    </button>
  );
}

function OrderStatusBadge({ status }: { status: OrderRow['status'] }) {
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
      className={`rounded-full px-2 py-0.5 text-[10px] tracking-ultra ${cls}`}
    >
      {status}
    </span>
  );
}

function PickupStatusBadge({
  status,
}: {
  status: OrderRow['pickup_status'];
}) {
  const cls =
    status === 'awaiting_coordination'
      ? 'bg-amber-500/20 text-amber-300'
      : status === 'coordinated'
      ? 'bg-blue-500/20 text-blue-300'
      : status === 'delivered'
      ? 'bg-emerald-500/20 text-emerald-300'
      : status === 'cancelled'
      ? 'bg-red-500/20 text-red-300'
      : 'bg-carbon-line text-bone/60';
  const label =
    status === 'awaiting_coordination'
      ? 'Pendiente coordinar'
      : status === 'coordinated'
      ? 'Coordinado'
      : status === 'delivered'
      ? 'Entregado'
      : status === 'cancelled'
      ? 'Cancelado'
      : '—';
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] tracking-ultra ${cls}`}
    >
      {label}
    </span>
  );
}

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
