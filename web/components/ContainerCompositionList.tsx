'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from './formatMoney';
import {
  effectiveCapacity,
  effectiveMinUnits,
  validateComposition,
  computeContainerPrice,
  type ContainerChild,
  type ContainerConfig,
  type CompositionLine,
} from '@/lib/container';
import {
  describeProgress,
  totalUnits,
  type BreakdownLine,
} from '@/lib/container-display';
import type { Product } from '@/lib/queries-client';

/**
 * Componente compartido para seleccionar el contenido de un producto
 * contenedor. Se usa en:
 *  - ContainerConfigurator (ficha del producto)
 *  - ContainerModal  (catálogo y edición desde carrito)
 *
 * El componente detecta automáticamente el modo:
 *
 *   - **Single-select (cards clickeables, sin +/−)** cuando la
 *     capacidad efectiva es 1 — es el caso por defecto del proyecto
 *     ("el cliente elige 1 alfajor por contenedor").
 *
 *   - **Multi-qty (+/−)** cuando la capacidad efectiva es > 1. Mantiene
 *     el comportamiento legacy del configurador por si el admin decide
 *     vender latas con varias unidades.
 *
 * Estado controlado:
 *   - El padre mantiene la fuente de verdad (composition + parentLineId).
 *   - Este componente es controlado: props composition + onChange.
 *
 * Pero también puede ser uncontrolled: si no se pasa `composition`, usa
 * estado interno y expone `onChange` cuando confirma. Útil en el modal
 * para gestionar el ciclo "abrir → elegir → confirmar".
 *
 * API en modo controlado (ficha):
 *   <ContainerCompositionList
 *     product={...}
 *     config={...}
 *     children={[...]}
 *     composition={composition}
 *     onChange={(lines, price) => ...}
 *   />
 *
 * API en modo uncontrolled (modal):
 *   <ContainerCompositionList
 *     product={...}
 *     config={...}
 *     children={[...]}
 *     initialComposition={prev}
 *     onChange={(lines, price) => ...}  // se llama cuando usuario cambia
 *     showTotal
 *     showConfirmButton
 *     onConfirm={() => ...}
 *     confirmLabel="Confirmar y agregar"
 *   />
 */
export default function ContainerCompositionList({
  product,
  config,
  children,
  composition,
  initialComposition,
  onChange,
  showTotal = true,
  showConfirmButton = false,
  onConfirm,
  confirmLabel = 'Confirmar y agregar',
  showFooterHint = true,
  attemptSubmit,
  onAttempted,
}: {
  product: Product;
  config: ContainerConfig;
  children: ContainerChild[];
  /** Controlled mode: estado externo. */
  composition?: CompositionLine[];
  /** Initial state en modo uncontrolled. */
  initialComposition?: CompositionLine[];
  /** Notifica al padre cada cambio de selección (controlled) o cuando
   *  se invoca el callback interno (uncontrolled). */
  onChange?: (lines: CompositionLine[], price: number) => void;
  showTotal?: boolean;
  showConfirmButton?: boolean;
  onConfirm?: () => void;
  confirmLabel?: string;
  /** Si false, oculta el microcopy "Esta configuración pesa X alfajores
   *  para el cálculo de envío". */
  showFooterHint?: boolean;
  /** Si true, se intentó submit y se muestra la lista de errores. */
  attemptSubmit?: boolean;
  /** Notifica cuando el usuario intenta confirmar pero la composición
   *  no es válida (para activar el visibility de errores). */
  onAttempted?: (attempted: boolean) => void;
}) {
  const cap = effectiveCapacity(config);
  const minU = effectiveMinUnits(config);
  const maxU = config.container_max_units ?? cap;
  const isSingle = cap <= 1;

  const [qty, setQty] = useState<Record<string, number>>(() => {
    // Controlled: derivamos de la prop. Uncontrolled: del initial.
    const source = composition ?? initialComposition ?? [];
    const init: Record<string, number> = {};
    for (const c of children) {
      const fromSource = source.find((s) => s.child_product_id === c.product.id);
      init[c.product.id] =
        fromSource?.qty ?? (c.min_qty > 0 ? c.min_qty : 0);
    }
    return init;
  });

  // Mantener qty en sync cuando cambian los children (admin updates).
  useEffect(() => {
    setQty((prev) => {
      const next: Record<string, number> = {};
      for (const c of children) {
        next[c.product.id] = prev[c.product.id] ?? (c.min_qty > 0 ? c.min_qty : 0);
      }
      return next;
    });
  }, [children]);

  const lines: CompositionLine[] = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, n]) => n > 0)
        .map(([child_product_id, qty]) => ({ child_product_id, qty })),
    [qty]
  );

  const total = totalUnits(lines);
  const validation = useMemo(
    () => validateComposition(config, children, lines),
    [config, children, lines]
  );
  const price = useMemo(
    () =>
      computeContainerPrice(
        config,
        product.price,
        children,
        lines,
        product.currency
      ),
    [config, product.price, product.currency, children, lines]
  );

  // Notificar al padre cada vez que cambian las líneas.
  useEffect(() => {
    if (!onChange) return;
    if (composition) {
      // controlled: sólo notificar si difiere
      const sameQty =
        composition.length === lines.length &&
        composition.every((l) => {
          const cur = lines.find((x) => x.child_product_id === l.child_product_id);
          return cur && cur.qty === l.qty;
        });
      if (!sameQty) onChange(lines, price.total);
    } else {
      // uncontrolled: notificar siempre
      onChange(lines, price.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines), price.total]);

  // ----- Multi-qty handlers -----
  const inc = (c: ContainerChild) => {
    setQty((prev) => {
      const cur = prev[c.product.id] ?? 0;
      if (isSingle) {
        // single-select: elegir este hijo implica qty=1 y limpiar el resto
        const next: Record<string, number> = {};
        for (const k of Object.keys(prev)) next[k] = 0;
        next[c.product.id] = 1;
        return next;
      }
      if (cur >= cap) return prev;
      if (c.max_qty != null && cur >= c.max_qty) return prev;
      const others = Object.entries(prev).reduce(
        (acc, [pid, n]) => acc + (pid === c.product.id ? 0 : n),
        0
      );
      if (others + cur + 1 > cap) return prev;
      return { ...prev, [c.product.id]: cur + 1 };
    });
  };

  const dec = (c: ContainerChild) => {
    setQty((prev) => {
      const cur = prev[c.product.id] ?? 0;
      if (cur <= 0) return prev;
      return { ...prev, [c.product.id]: cur - 1 };
    });
  };

  // ----- Single-select handler -----
  const selectSingle = (c: ContainerChild) => {
    setQty(() => {
      const next: Record<string, number> = {};
      for (const k of Object.keys(qty)) next[k] = 0;
      next[c.product.id] = c.min_qty > 0 ? c.min_qty : 1;
      return next;
    });
  };

  const selectedCount = Object.values(qty).filter((n) => n > 0).length;

  const canConfirm = validation.ok && total >= minU && total <= maxU;

  const handleConfirm = () => {
    if (!canConfirm) {
      onAttempted?.(true);
      return;
    }
    onConfirm?.();
  };

  if (children.length === 0) {
    return (
      <div className="border border-ink/15 bg-bone p-6">
        <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
          Personalización no disponible
        </p>
        <p className="mt-3 font-body text-sm leading-relaxed text-ink/70">
          Este producto todavía no tiene opciones configuradas. Escribinos
          por WhatsApp y te armamos el pack a tu medida.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="container-list-heading"
      className="border border-ink/15 bg-bone"
    >
      <header className="border-b border-ink/15 px-5 py-5 sm:px-7 sm:py-6">
        <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
          Personalizá el contenido de tu {product.name}
        </p>
        <h3
          id="container-list-heading"
          className="mt-1 font-display text-2xl leading-tight text-ink sm:text-3xl"
        >
          {isSingle
            ? 'Elegí 1 alfajor para tu pack'
            : 'Elegí qué llevar adentro'}
        </h3>
        <p
          className={[
            'mt-3 font-body text-sm leading-relaxed',
            total === cap ? 'text-emerald-700' : 'text-ink/65',
          ].join(' ')}
        >
          {describeProgress(lines, cap)}
          {isSingle && total === 0 && (
            <span className="ml-1 text-ink/55">
              · tocá una opción para personalizar.
            </span>
          )}
        </p>
        {config.container_require_full && total < cap && (
          <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 font-body text-[11px] leading-relaxed text-amber-800">
            Este contenedor requiere completar las {cap} unidades antes de
            poder agregarlo.
          </p>
        )}
      </header>

      {isSingle ? (
        // ----- Single-select: grid de cards clickeables -----
        <ul
          role="radiogroup"
          aria-label="Elegí un alfajor"
          className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-6 lg:grid-cols-3"
        >
          {children.map((c) => {
            const cur = qty[c.product.id] ?? 0;
            const checked = cur > 0;
            return (
              <li key={c.product.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => selectSingle(c)}
                  className={[
                    'group relative flex w-full flex-col overflow-hidden rounded-xl border text-left transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                    checked
                      ? 'border-gold bg-cream shadow-[0_0_0_2px_rgba(184,134,51,0.18)]'
                      : 'border-ink/15 bg-cream hover:-translate-y-0.5 hover:border-gold/40',
                    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  ].join(' ')}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.product.image ?? '/Logo.jpg'}
                      alt={c.product.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                    {checked && (
                      <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-gold text-cream shadow-md">
                        <svg
                          width="14"
                          height="14"
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
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="font-display text-base leading-tight text-ink">
                      {c.product.name}
                    </p>
                    <p className="mt-auto font-body text-sm text-ink/70">
                      {formatMoney(c.product.price, c.product.currency)}{' '}
                      <span className="text-ink/50">c/u</span>
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        // ----- Multi-qty: rows con +/-/image/price (legacy) -----
        <ul className="divide-y divide-ink/10 px-5 sm:px-7">
          {children.map((c) => {
            const cur = qty[c.product.id] ?? 0;
            const disabledAdd =
              cur >= cap ||
              (c.max_qty != null && cur >= c.max_qty) ||
              total >= cap;
            const disabledDec = cur <= 0;
            return (
              <li
                key={c.product.id}
                className="flex items-center gap-4 py-4"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden bg-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.product.image ?? '/Logo.jpg'}
                    alt={c.product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-display text-base text-ink leading-tight">
                    {c.product.name}
                  </p>
                  <p className="mt-1 font-body text-xs text-ink/60">
                    {formatMoney(c.product.price, c.product.currency)} c/u
                    {c.min_qty > 0 && (
                      <span className="ml-2 text-ink/50">· mín {c.min_qty}</span>
                    )}
                    {c.max_qty != null && (
                      <span className="ml-2 text-ink/50">· máx {c.max_qty}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dec(c)}
                    disabled={disabledDec}
                    aria-label={`Quitar uno de ${c.product.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full border border-ink/30 text-ink transition hover:border-ink disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-display text-lg text-ink">
                    {cur}
                  </span>
                  <button
                    type="button"
                    onClick={() => inc(c)}
                    disabled={disabledAdd}
                    aria-label={`Sumar uno de ${c.product.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full border border-gold text-gold transition hover:bg-gold hover:text-cream disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Resumen + CTA */}
      {(showTotal || showConfirmButton) && (
        <div className="border-t border-ink/15 px-5 py-5 sm:px-7 sm:py-6 space-y-4">
          {showTotal && lines.length > 0 && (
            <ul className="space-y-1.5 font-body text-sm text-ink/80">
              {price.breakdown.map((b, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{b.label}</span>
                  <span className="text-ink/70">
                    {formatMoney(b.amount, price.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {showTotal && (
            <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
              <span className="font-body text-[10px] uppercase tracking-ultra text-ink/55">
                Total
              </span>
              <span className="font-display text-2xl text-ink">
                {formatMoney(price.total, price.currency)}
              </span>
            </div>
          )}

          {attemptSubmit && !canConfirm && validation.errors.length > 0 && (
            <ul className="space-y-1 rounded-sm border border-red-200 bg-red-50 px-3 py-2 font-body text-xs text-red-700">
              {validation.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}

          {showConfirmButton && (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="block w-full rounded-full bg-ink px-6 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon disabled:cursor-not-allowed disabled:bg-ink/30 disabled:text-ink/50 disabled:hover:bg-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {confirmLabel}
            </button>
          )}

          {showFooterHint && total > 0 && (
            <p className="text-center font-body text-[11px] text-ink/55">
              Esta configuración pesa {total} alfajor{total === 1 ? '' : 'es'}{' '}
              para el cálculo de envío.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// Helper export para que el configurador existente (ContainerConfigurator)
// pueda seguir usando el cálculo de progreso sin duplicar lógica.
export { describeProgress };
export type { BreakdownLine };
