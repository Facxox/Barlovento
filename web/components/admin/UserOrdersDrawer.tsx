'use client';

import { useEffect, useState } from 'react';
import type { OrderRow } from '@/lib/orders';

const formatUY = (n: number) =>
  new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  }).format(n);

const statusColor: Record<OrderRow['status'], string> = {
  pending: 'bg-amber-500/20 text-amber-300',
  paid: 'bg-emerald-500/20 text-emerald-300',
  fulfilled: 'bg-sky-500/20 text-sky-300',
  cancelled: 'bg-red-500/20 text-red-400',
};

export default function UserOrdersDrawer({
  email,
  userLabel,
  open,
  onClose,
}: {
  email: string | null;
  userLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !email) return;
    setLoading(true);
    setError(null);
    setOrders(null);
    fetch(`/api/admin/user-orders?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
          setOrders([]);
        } else {
          setOrders((data.orders as OrderRow[]) ?? []);
        }
      })
      .catch((e) => setError(e.message ?? 'Error al cargar.'))
      .finally(() => setLoading(false));
  }, [open, email]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={`Pedidos de ${userLabel}`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-carbon-line bg-carbon"
      >
        <header className="flex items-start justify-between border-b border-carbon-line px-6 py-5">
          <div>
            <p className="text-eyebrow">Pedidos del cliente</p>
            <h2 className="mt-1 font-display text-2xl text-bone">
              {userLabel}
            </h2>
            <p className="mt-1 font-body text-xs text-bone/50">{email}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-bone hover:border-gold"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <p className="text-center font-body text-sm text-bone/60">
              Cargando pedidos…
            </p>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="font-body text-sm text-red-300">
                No pudimos cargar los pedidos: {error}
              </p>
            </div>
          )}

          {!loading && !error && orders && orders.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="font-display italic text-2xl text-bone/70">
                  Sin pedidos
                </p>
                <p className="mt-2 font-body text-sm text-bone/50">
                  Este cliente todavía no hizo pedidos con este email.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && orders && orders.length > 0 && (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-2xl border border-carbon-line bg-carbon-raised p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-display text-lg text-bone">
                      #{o.id}
                    </div>
                    <span className="font-display text-lg text-gold">
                      {formatUY(Number(o.total))}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-[11px] uppercase tracking-ultra text-bone/50">
                    {formatLongDate(o.created_at)}
                    {' · '}
                    {o.channel === 'mercadopago' ? 'Mercado Pago' : 'WhatsApp'}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra',
                        statusColor[o.status] ?? 'bg-carbon-line text-bone/60',
                      ].join(' ')}
                    >
                      {o.status}
                    </span>
                    <span className="font-body text-[11px] text-bone/60">
                      {(Array.isArray(o.items) ? o.items : []).reduce(
                        (acc, it) => acc + it.qty,
                        0
                      )}{' '}
                      unidades
                    </span>
                  </div>
                  {Array.isArray(o.items) && o.items.length > 0 && (
                    <ul className="mt-3 space-y-1 font-body text-xs text-bone/70">
                      {o.items.map((it, idx) => (
                        <li key={`${o.id}-${idx}`}>
                          · {it.qty} x {it.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

const MONTHS_LONG_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Formato fijo dd de <mes> yyyy para evitar hydration mismatches. */
function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} de ${MONTHS_LONG_ES[d.getMonth()]} ${d.getFullYear()}`;
}
