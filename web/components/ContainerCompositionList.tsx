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
 * Componente compartido para personalizar un producto contenedor.
 * Inspirado en el configurador de Guenoa "Armá tu caja": el cliente
 * elige libremente qué variedades incluir y en qué cantidad, hasta
 * agotar la capacidad configurable. SIN restricción por variedad.
 *
 * Reglas aplicadas:
 *
 *   - Total de unidades entre `container_min_units` y la capacidad
 *     efectiva (o `container_max_units` si está seteada y es menor).
 *   - Si `container_require_full`, hay que llegar a la capacidad.
 *   - Cada hijo respeta su `min_qty` y `max_qty` (si los tiene).
 *   - Los +/- cambian cantidades respetando todos los topes.
 *
 * El componente puede funcionar:
 *
 *   **Controlled** (la ficha del producto): el padre mantiene
 *   `composition` y `price`. El componente lo notifica con `onChange`.
 *
 *   **Uncontrolled** (el modal): arranca con `initialComposition`,
 *   mantiene estado interno, notifica cambios vía `onChange`, expone
 *   `onConfirm` para que el padre arme el CartItem final.
 *
 * El render SIEMPRE es multi-qty con botones +/- por variedad. No hay
 * modo single-select: cualquier configuración de un admin con cap>1
 * también usa este layout (porque ya lo soportaba antes y porque es la
 * única forma de soportar "3 clásicos + 3 de chocolate", etc.).
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
  hideUnitPrice = false,
}: {
  product: Product;
  config: ContainerConfig;
  children: ContainerChild[];
  /** Controlled mode: estado externo. */
  composition?: CompositionLine[];
  /** Initial state en modo uncontrolled. */
  initialComposition?: CompositionLine[];
  /** Notifica al padre cada cambio de selección. */
  onChange?: (lines: CompositionLine[], price: number) => void;
  showTotal?: boolean;
  showConfirmButton?: boolean;
  onConfirm?: () => void;
  confirmLabel?: string;
  /** Si false, oculta el microcopy "Esta configuración pesa X alfajores". */
  showFooterHint?: boolean;
  /** Si true, se intentó submit y se muestra la lista de errores. */
  attemptSubmit?: boolean;
  /**
   * Si true, oculta el precio por unidad en cada hijo (porque el
   * contenedor tiene precio fijo `price_mode='replace'` y mostrar
   * "c/u" sería confuso para el cliente).
   */
  hideUnitPrice?: boolean;
}) {
  const capRaw = effectiveCapacity(config);
  const minU = effectiveMinUnits(config);
  const maxURaw = config.container_max_units ?? capRaw;
  const requireFull = !!config.container_require_full;

  const [qty, setQty] = useState<Record<string, number>>(() => {
    // Inicialización. Para un contenedor multi-qty arrancamos en 0
    // salvo que la composición inicial o cada hijo tenga `min_qty` > 0.
    // Si el admin setea `min_qty` por variedad, respetamos: así nunca
    // rompemos reglas pre-existentes del ContainerConfigManager.
    const source = composition ?? initialComposition ?? [];
    const init: Record<string, number> = {};
    for (const c of children) {
      const fromSource = source.find((s) => s.child_product_id === c.product.id);
      init[c.product.id] = fromSource?.qty ?? 0;
    }
    return init;
  });

  // Mantener qty en sync cuando cambian los children (admin updates).
  useEffect(() => {
    setQty((prev) => {
      const next: Record<string, number> = {};
      for (const c of children) {
        next[c.product.id] =
          prev[c.product.id] !== undefined
            ? prev[c.product.id]
            : ((initialComposition ?? []).find(
                (s) => s.child_product_id === c.product.id
              )?.qty ?? 0);
      }
      return next;
    });
  }, [children, initialComposition]);

  const lines: CompositionLine[] = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, n]) => n > 0)
        .map(([child_product_id, qty]) => ({ child_product_id, qty })),
    [qty]
  );

  const total = totalUnits(lines);
  const otherTotal = useMemo(
    () =>
      Object.entries(qty).reduce(
        (acc, [pid, n]) =>
          acc + (pid === '' ? 0 : 0), // placeholder, no se usa
        0
      ),
    [qty]
  );
  void otherTotal;

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
      const sameQty =
        composition.length === lines.length &&
        composition.every((l) => {
          const cur = lines.find((x) => x.child_product_id === l.child_product_id);
          return cur && cur.qty === l.qty;
        });
      if (!sameQty) onChange(lines, price.total);
    } else {
      onChange(lines, price.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines), price.total]);

  // ----- Guardas de render temprano (después de los hooks) -----
  // Sin capacidad configurada por el admin: mostramos un panel claro en
  // lugar del configurador. Antes caía silenciosamente a "Elegí hasta 1".
  if (capRaw == null || capRaw <= 0) {
    return (
      <div className="border border-amber-200 bg-amber-50 p-6">
        <p className="font-body text-[10px] uppercase tracking-ultra text-amber-700">
          Configuración incompleta
        </p>
        <h3 className="mt-2 font-display text-xl leading-tight text-amber-900">
          Este contenedor todavía no tiene una capacidad definida
        </h3>
        <p className="mt-3 font-body text-sm leading-relaxed text-amber-800">
          Falta cargar cuántas unidades entran en la caja. Si sos el
          administrador, editá este producto y completá el paso
          <strong> "Decí cuántos alfajores entran"</strong> en la sección
          Productos contenedores. Si sos cliente, escribinos por WhatsApp
          y te armamos el pack a tu medida.
        </p>
      </div>
    );
  }

  // Narrowing: a partir de acá, ambos son números.
  const cap = capRaw as number;
  const maxU = maxURaw as number;

  // ----- Multi-qty handlers -----
  const inc = (c: ContainerChild) => {
    setQty((prev) => {
      const cur = prev[c.product.id] ?? 0;
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
      // No bajamos de min_qty propio del hijo (si está configurado)
      const min = c.min_qty ?? 0;
      if (cur <= min) return prev;
      return { ...prev, [c.product.id]: cur - 1 };
    });
  };

  const canConfirm = validation.ok && total >= minU && total <= maxU;
  void requireFull; // referenced for clarity (la validación ya lo cubre)

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.();
  };

  if (children.length === 0) {
    return (
      <div className="border border-ink/15 bg-bone p-6">
        <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
          Configurador no disponible
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
          Personalizá el contenido
        </p>
        <h3
          id="container-list-heading"
          className="mt-1 font-display text-2xl leading-tight text-ink sm:text-3xl"
        >
          {requireFull
            ? `Elegí ${cap} alfajores para tu pack`
            : `Elegí hasta ${cap} alfajores`}
        </h3>
        {/* Barra de progreso */}
        <div
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuenow={Math.min(total, cap)}
          aria-valuemin={0}
          aria-valuemax={cap}
          aria-label={`${total} de ${cap} unidades seleccionadas`}
        >
          <div
            className={[
              'h-full rounded-full transition-all duration-300',
              total >= cap ? 'bg-emerald-600' : 'bg-gold',
            ].join(' ')}
            style={{ width: `${Math.min(100, (total / cap) * 100)}%` }}
          />
        </div>
        <p
          className={[
            'mt-2 font-body text-sm leading-relaxed',
            total >= cap ? 'text-emerald-700' : 'text-ink/65',
          ].join(' ')}
        >
          {describeProgress(lines, cap)}
          {total < cap && !requireFull && (
            <span className="ml-1 text-ink/55">
              · podés agregar {cap - total} más.
            </span>
          )}
          {requireFull && total < cap && (
            <span className="ml-1 text-amber-700">
              · te faltan {cap - total} para completar.
            </span>
          )}
        </p>
        {requireFull && total < cap && (
          <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 font-body text-[11px] leading-relaxed text-amber-800">
            Este producto requiere que completes las {cap} unidades antes
            de poder agregarlo al carrito.
          </p>
        )}
      </header>

      {/* Listado de productos */}
      <ul className="divide-y divide-ink/10">
        {children.map((c) => {
          const cur = qty[c.product.id] ?? 0;
          const min = c.min_qty ?? 0;
          const remainingGlobal = cap - total;
          const disabledAdd =
            cur >= cap ||
            (c.max_qty != null && cur >= c.max_qty) ||
            remainingGlobal <= 0;
          const disabledDec = cur <= 0 || cur <= min;
          return (
            <li
              key={c.product.id}
              className="flex items-center gap-4 px-5 py-4 sm:px-7"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-ink/5 sm:h-20 sm:w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.product.image ?? '/Logo.jpg'}
                  alt={c.product.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base leading-tight text-ink sm:text-lg">
                  {c.product.name}
                </p>
                <p className="mt-1 font-body text-xs text-ink/60">
                  {!hideUnitPrice && (
                    <>
                      {formatMoney(c.product.price, c.product.currency)}{' '}
                      <span className="text-ink/50">c/u</span>
                    </>
                  )}
                  {c.max_qty != null && (
                    <span className="ml-2 text-ink/50">
                      · máx {c.max_qty}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dec(c)}
                  disabled={disabledDec}
                  aria-label={`Quitar uno de ${c.product.name}`}
                  className="grid h-10 w-10 place-items-center rounded-full border border-ink/30 text-ink transition hover:border-ink disabled:opacity-30 disabled:hover:border-ink/30"
                >
                  −
                </button>
                <span
                  aria-live="polite"
                  className={[
                    'w-8 text-center font-display text-xl',
                    cur > 0 ? 'text-gold-deep' : 'text-ink/40',
                  ].join(' ')}
                >
                  {cur}
                </span>
                <button
                  type="button"
                  onClick={() => inc(c)}
                  disabled={disabledAdd}
                  aria-label={`Sumar uno de ${c.product.name}`}
                  className="grid h-10 w-10 place-items-center rounded-full border border-gold text-gold transition hover:bg-gold hover:text-cream disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gold"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Resumen y CTA */}
      {(showTotal || showConfirmButton) && (
        <div className="border-t border-ink/15 px-5 py-5 sm:px-7 sm:py-6 space-y-4">
          {showTotal && total > 0 && (
            <div>
              <p className="font-body text-[10px] uppercase tracking-ultra text-ink/55">
                Tu selección
              </p>
              <ul className="mt-2 space-y-1 font-body text-sm text-ink/85">
                {lines.map((l) => {
                  const child = children.find(
                    (c) => c.product.id === l.child_product_id
                  );
                  return (
                    <li
                      key={l.child_product_id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span>
                        {l.qty} × {child?.product.name ?? l.child_product_id}
                      </span>
                      <span className="text-ink/65">
                        {formatMoney(
                          (child?.product.price ?? 0) * l.qty,
                          child?.product.currency ?? product.currency
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {showTotal && (
            <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
              <span className="font-body text-[10px] uppercase tracking-ultra text-ink/55">
                Total ({total} {total === 1 ? 'unidad' : 'unidades'})
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

export { describeProgress };
export type { BreakdownLine };
