'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from './CartContext';
import { formatMoney } from './formatMoney';

export type MerchProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  description: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  /**
   * Si es true, ya agregamos al menos un producto de merch y el CTA
   * principal del modal cambia a "Seguir al pago" para no quedar
   * atrapado en el upsell.
   */
  addedAny?: boolean;
};

/**
 * Modal de upsell de Barlovento Momentos (categoría `merch`).
 *
 * Se muestra al apretar "Pagar con Mercado Pago" en el checkout.
 * Ofrece 3 productos al azar de la categoría merch. Si el cliente
 * agrega uno al carrito, vuelve al checkout para revisar el pedido.
 * Si no quiere nada, sigue directo a Mercado Pago.
 *
 * Diseño:
 *  - Backdrop borroso sobre el checkout.
 *  - Panel tipo "soft UI" con esquinas 18px y sombra multicapa.
 *  - 3 cards de producto con hover lift + CTA primario dorado.
 *  - Accesible: focus trap básico, ESC para cerrar, aria-modal.
 */
export default function MerchUpsellModal({
  open,
  onClose,
  onProceed,
  addedAny = false,
}: Props) {
  const { add } = useCart();
  const [products, setProducts] = useState<MerchProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Fetch de los 3 productos al abrir el modal.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/merch/upsell', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { ok?: boolean; products?: MerchProduct[] }) => {
        if (cancelled) return;
        setProducts(data?.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos cargar la merch.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Focus en el botón cerrar al abrir. ESC para cerrar.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Bloqueamos el scroll del body mientras el modal está abierto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleAdd = (p: MerchProduct) => {
    if (addingId) return;
    setAddingId(p.id);
    add({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: p.currency,
      image: p.image,
      unitsPerPack: 1,
    });
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(p.id);
      return next;
    });
    // Feedback corto antes de permitir otra interacción.
    setTimeout(() => setAddingId(null), 600);
  };

  // Si la API no devolvió merch, no tiene sentido mostrar el modal —
  // cerramos y dejamos seguir al cliente.
  const shouldShowContent =
    !loading && !error && products && products.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="merch-upsell-title"
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-carbon/70 backdrop-blur-sm transition-opacity"
      />

      {/* Panel */}
      <div
        className={[
          'relative w-full max-w-3xl overflow-hidden bg-bone text-ink',
          'rounded-t-[18px] sm:rounded-[18px]',
          'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_64px_-16px_rgba(0,0,0,0.35)]',
          'border border-gold/20',
          'max-h-[92vh] overflow-y-auto',
        ].join(' ')}
      >
        {/* Acento dorado superior */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-7 sm:px-8">
          <div>
            <p className="text-eyebrow text-gold-deep">
              Barlovento Momentos
            </p>
            <h2
              id="merch-upsell-title"
              className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl font-light"
            >
              ¿Seguro que no te llevás algo?
            </h2>
            <p className="mt-2 max-w-prose font-body text-sm text-ink/70">
              Antes de pagar, mirá estos productos para sumar a tu pedido.
              Si no querés nada, seguí al pago como siempre.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 bg-cream text-ink/70 transition hover:-translate-y-0.5 hover:border-ink/40 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
          {loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-[14px] border border-ink/10 bg-cream"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50/80 px-4 py-3 font-body text-sm text-red-700">
              {error}
            </div>
          )}

          {shouldShowContent && (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {products!.map((p) => {
                const wasAdded = addedIds.has(p.id);
                const isAdding = addingId === p.id;
                return (
                  <li
                    key={p.id}
                    className="group flex flex-col overflow-hidden rounded-[14px] border border-ink/12 bg-cream shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.10)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_16px_32px_-10px_rgba(184,134,51,0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.name}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="font-display text-lg leading-tight text-ink">
                        {p.name}
                      </h3>
                      {p.description && (
                        <p className="line-clamp-2 font-body text-xs text-ink/60">
                          {p.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <span className="font-display text-xl text-ink">
                          {formatMoney(p.price, p.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdd(p)}
                          disabled={isAdding}
                          aria-label={`Agregar ${p.name} al carrito`}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-body text-[10px] uppercase tracking-ultra transition',
                            wasAdded
                              ? 'bg-emerald-600 text-cream'
                              : 'bg-ink text-cream hover:bg-gold hover:text-carbon',
                            'disabled:cursor-not-allowed disabled:opacity-70',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                          ].join(' ')}
                        >
                          {wasAdded ? (
                            <>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Agregado
                            </>
                          ) : isAdding ? (
                            'Agregando…'
                          ) : (
                            <>
                              Agregar
                              <span aria-hidden>+</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && !error && products && products.length === 0 && (
            <div className="rounded-[10px] border border-ink/10 bg-cream px-4 py-6 text-center font-body text-sm text-ink/70">
              Por ahora no tenemos merch para mostrarte. ¡Seguí al pago!
            </div>
          )}

          {/* Footer CTAs */}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onClose}
              className="font-body text-xs uppercase tracking-ultra text-ink/60 hover:text-ink focus:outline-none focus-visible:underline"
            >
              Seguir revisando el carrito
            </button>
            <button
              type="button"
              onClick={onProceed}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {addedAny
                ? 'Seguir al pago de Mercado Pago'
                : 'No, gracias — pagar con Mercado Pago'}
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
