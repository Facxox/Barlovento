'use client';

import { useEffect } from 'react';
import type { OrderRow } from '@/lib/orders';
import type { Nutrition } from '@/lib/queries';
import { receiptThumbUrl, receiptFullUrl } from '@/lib/receiptUrl';

/**
 * Forma mínima del producto que el drawer necesita para enriquecer un
 * item del pedido (que viene como snapshot denormalizado en
 * `OrderRow.items`). Construido server-side en
 * `app/admin/pedidos/page.tsx` a partir de `getProducts()`.
 */
export type DrawerProduct = {
  image: string;
  description: string;
  badge: string | null;
  category: string;
  price: number;
  currency: string;
  nutrition: Nutrition | null;
};

type Props = {
  open: boolean;
  order: OrderRow | null;
  onClose: () => void;
  productById: Record<string, DrawerProduct>;
};

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

function formatMoney(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const rounded = Math.round(n);
  const withSep = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sym}${withSep}`;
}

const MONTHS_LONG_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Formato fijo dd de <mes> yyyy — evita hydration mismatch. */
function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} de ${MONTHS_LONG_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy}, ${hh}:${mi}`;
}

const statusColor: Record<OrderRow['status'], string> = {
  pending: 'bg-amber-500/20 text-amber-300',
  paid: 'bg-emerald-500/20 text-emerald-300',
  fulfilled: 'bg-sky-500/20 text-sky-300',
  cancelled: 'bg-red-500/20 text-red-400',
};

const channelColor: Record<OrderRow['channel'], string> = {
  mercadopago: 'bg-blue-500/20 text-blue-300',
  bank_transfer: 'bg-purple-500/20 text-purple-300',
  whatsapp: 'bg-emerald-500/20 text-emerald-300',
};

const channelLabel: Record<OrderRow['channel'], string> = {
  mercadopago: 'Mercado Pago',
  bank_transfer: 'Transferencia',
  whatsapp: 'WhatsApp',
};

const customerTypeLabel: Record<OrderRow['customer_type'], string> = {
  retail: 'Minorista',
  wholesale: 'Mayorista',
};

const pickupStatusLabel: Record<NonNullable<OrderRow['pickup_status']>, string> = {
  awaiting_coordination: 'Esperando coordinación',
  coordinated: 'Coordinado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function PedidoDetailDrawer({
  open,
  order,
  onClose,
  productById,
}: Props) {
  // Cerrar con tecla Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !order) return null;

  const items = Array.isArray(order.items) ? order.items : [];

  // Subtotal calculado sobre el snapshot del pedido (no el precio actual
  // del producto), que es lo que el cliente pagó.
  const subtotal = items.reduce(
    (acc, it) => acc + Number(it.qty || 0) * Number(it.price || 0),
    0
  );

  // Construye un link wa.me aceptando formatos comunes (54911..., +549 11 ...).
  function waLink(phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    return `https://wa.me/${digits}`;
  }

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
        aria-label={`Detalle del pedido #${order.id}`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-carbon-line bg-carbon"
      >
        {/* HEADER */}
        <header className="flex items-start justify-between gap-4 border-b border-carbon-line px-6 py-5">
          <div className="min-w-0">
            <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
              Pedido #{order.id}
            </p>
            <h2 className="mt-1 truncate font-display text-2xl text-bone">
              {formatLongDate(order.created_at)}
            </h2>
            <p className="mt-1 font-body text-xs text-bone/50">
              {formatDateTime(order.created_at)}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span
                className={[
                  'rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra',
                  statusColor[order.status],
                ].join(' ')}
              >
                {order.status}
              </span>
              <span
                className={[
                  'rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra',
                  channelColor[order.channel],
                ].join(' ')}
              >
                {channelLabel[order.channel]}
              </span>
              <span
                className={[
                  'rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra',
                  order.fulfillment === 'pickup'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-carbon-line text-bone/60',
                ].join(' ')}
              >
                {order.fulfillment === 'pickup' ? 'Retiro' : 'Envío'}
              </span>
              <span className="rounded-full bg-carbon-line px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-bone/60">
                {customerTypeLabel[order.customer_type]}
              </span>
              {order.pickup_status && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-sky-300">
                  Pickup: {pickupStatusLabel[order.pickup_status]}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <p className="font-display text-2xl text-gold">
              {formatMoney(Number(order.total), order.currency)}
            </p>
            <button
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-bone hover:border-gold"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* CLIENTE */}
          <Section title="Cliente">
            <dl className="grid grid-cols-1 gap-3 font-body text-sm sm:grid-cols-3">
              <Field label="Nombre">
                {order.customer_name ?? '—'}
              </Field>
              <Field label="Email">
                {order.customer_email ? (
                  <a
                    href={`mailto:${order.customer_email}`}
                    className="text-gold-light underline-offset-2 hover:underline"
                  >
                    {order.customer_email}
                  </a>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Teléfono">
                {(() => {
                  const link = waLink(order.customer_phone);
                  if (link) {
                    return (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-light underline-offset-2 hover:underline"
                      >
                        {order.customer_phone} ↗
                      </a>
                    );
                  }
                  return order.customer_phone ?? '—';
                })()}
              </Field>
              <Field label="Dirección" wide>
                {order.customer_address ?? '—'}
              </Field>
              <Field label="Ciudad">
                {order.customer_city ?? '—'}
              </Field>
              <Field label="Notas del cliente" wide>
                {order.customer_notes ? (
                  <p className="whitespace-pre-wrap text-bone/80">
                    {order.customer_notes}
                  </p>
                ) : (
                  '—'
                )}
              </Field>
            </dl>
          </Section>

          {/* PRODUCTOS */}
          <Section title="Productos">
            {items.length === 0 ? (
              <p className="font-body text-sm text-bone/60">
                Este pedido no tiene items.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((it, idx) => {
                  const product = productById[it.id];
                  const productName = it.name;
                  const productBadge = product?.badge ?? null;
                  const productImage = product?.image ?? null;
                  const productCategory = product?.category ?? null;
                  const productDescription = product?.description ?? null;
                  const lineSubtotal =
                    Number(it.qty || 0) * Number(it.price || 0);

                  return (
                    <li
                      key={`${order.id}-${idx}-${it.id}`}
                      className="flex gap-4 rounded-2xl border border-carbon-line bg-carbon-raised p-4"
                    >
                      {/* Thumbnail */}
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-carbon-line bg-carbon">
                        {productImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={productImage}
                            alt={productName}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center font-body text-[10px] uppercase tracking-ultra text-bone/40">
                            sin imagen
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-display text-base text-bone">
                              {productName}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {productBadge && (
                                <span className="rounded-full bg-gold/20 px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-gold">
                                  {productBadge}
                                </span>
                              )}
                              {productCategory && (
                                <span className="rounded-full bg-carbon-line px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-bone/60">
                                  {productCategory}
                                </span>
                              )}
                              {!product && (
                                <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-red-300">
                                  producto eliminado
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right font-body text-xs text-bone/70">
                            <p>
                              {it.qty} ×{' '}
                              <span className="text-bone">
                                {formatMoney(Number(it.price), it.currency)}
                              </span>
                            </p>
                            <p className="mt-0.5 font-display text-base text-gold">
                              {formatMoney(lineSubtotal, it.currency)}
                            </p>
                          </div>
                        </div>

                        {productDescription && (
                          <p className="mt-2 line-clamp-2 font-body text-xs text-bone/60">
                            {productDescription}
                          </p>
                        )}

                        <p className="mt-1 font-body text-[10px] uppercase tracking-ultra text-bone/40">
                          ID: {it.id}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* COSTOS */}
          <Section title="Costos">
            <dl className="space-y-2 font-body text-sm">
              <CostRow
                label="Subtotal"
                value={formatMoney(subtotal, order.currency)}
              />
              {order.shipping_cost != null && Number(order.shipping_cost) > 0 && (
                <CostRow
                  label="Envío"
                  value={formatMoney(
                    Number(order.shipping_cost),
                    order.shipping_currency || order.currency
                  )}
                />
              )}
              {order.coupon_code && (
                <CostRow
                  label={`Cupón (${order.coupon_code})`}
                  value={
                    order.coupon_discount
                      ? `− ${formatMoney(
                          Number(order.coupon_discount),
                          order.currency
                        )}`
                      : 'aplicado'
                  }
                />
              )}
              <div className="!mt-3 flex items-baseline justify-between border-t border-carbon-line pt-3">
                <dt className="font-body text-xs uppercase tracking-ultra text-bone/60">
                  Total
                </dt>
                <dd className="font-display text-xl text-gold">
                  {formatMoney(Number(order.total), order.currency)}
                </dd>
              </div>
            </dl>
          </Section>

          {/* COMPROBANTE */}
          {order.channel === 'bank_transfer' && order.receipt_url && (
            <Section title="Comprobante de transferencia">
              <a
                href={receiptFullUrl(order.receipt_url) ?? order.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-2xl border border-purple-500/40 bg-purple-500/10 p-3 transition hover:bg-purple-500/20"
              >
                {receiptThumbUrl(order.receipt_url, 80) &&
                  !/\.pdf(\?|$)/i.test(order.receipt_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={receiptThumbUrl(order.receipt_url, 80)!}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className="h-12 w-12 rounded-lg border border-purple-300/40 object-cover"
                    />
                  )}
                <span className="font-body text-sm text-purple-200">
                  Ver comprobante completo ↗
                </span>
              </a>
            </Section>
          )}

          {/* MERCADO PAGO */}
          {order.channel === 'mercadopago' && (order.mp_payment_id || order.mp_preference_id) && (
            <Section title="Mercado Pago">
              <dl className="space-y-2 font-mono text-xs text-bone/80">
                {order.mp_payment_id && (
                  <div>
                    <dt className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                      Payment ID
                    </dt>
                    <dd className="break-all">{order.mp_payment_id}</dd>
                  </div>
                )}
                {order.mp_preference_id && (
                  <div>
                    <dt className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                      Preference ID
                    </dt>
                    <dd className="break-all">{order.mp_preference_id}</dd>
                  </div>
                )}
              </dl>
            </Section>
          )}
        </div>
      </aside>
    </>
  );
}

/* ---------- sub-componentes presentation-only ---------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 font-body text-[10px] uppercase tracking-ultra text-bone/50">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-3' : ''}>
      <dt className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        {label}
      </dt>
      <dd className="mt-0.5 text-bone">{children}</dd>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="font-body text-xs uppercase tracking-ultra text-bone/60">
        {label}
      </dt>
      <dd className="font-body text-sm text-bone">{value}</dd>
    </div>
  );
}
