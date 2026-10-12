'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ContainerCompositionList from './ContainerCompositionList';
import { formatMoney } from './formatMoney';
import {
  computeContainerPrice,
  effectiveCapacity,
  effectiveMinUnits,
  validateComposition,
  type CompositionLine,
  type ContainerChild,
  type ContainerConfig,
} from '@/lib/container';
import type { Product, CartItemCompositionLine } from '@/lib/queries-client';
import { totalUnits } from '@/lib/container-display';

type Mode = 'add' | 'edit';

export type ContainerModalProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Modo del modal. `add` para el catálogo, `edit` para reabrir desde el
   * carrito. Cambia el copy del CTA y el heading.
   */
  mode?: Mode;
  product: Product;
  config: ContainerConfig;
  children: ContainerChild[];
  /**
   * Composición inicial (modo edit). Si está vacía o undefined, el
   * configurador arranca sin selección.
   */
  initialComposition?: CartItemCompositionLine[];
  /**
   * parentLineId actual (modo edit). Si no se pasa, se computa uno
   * determinístico a partir del product.id + composition.
   */
  parentLineId?: string;
  /**
   * Si true, muestra skeleton mientras se cargan los hijos.
   * El modal abre igual; sólo bloquea la confirmación.
   */
  loading?: boolean;
  /**
   * Confirmación. El padre construye el CartItem con la composición
   * final y llama a `addContainer` o a la action de update.
   */
  onConfirm: (composition: CompositionLine[], total: number) => void;
};

/**
 * Modal reusable para personalizar el contenido de un producto
 * contenedor. Inspirado en el configurador "Armá tu caja" de Guenoa:
 *
 *   - Layout 2-columnas en desktop (md+): catálogo a la izquierda,
 *     resumen dinámico + CTA sticky a la derecha.
 *   - En mobile: drawer bottom con CTA fijo abajo, accesible siempre.
 *   - Barra de progreso superior, capacidad destacada, copy claro.
 *   - Resumen lateral con line items, total y CTA "Confirmar y agregar".
 *
 * Mismo shell visual que `MerchUpsellModal` (overlay `bg-carbon/70` +
 * panel `rounded-[18px]` + ESC + scroll lock + focus inicial en cerrar).
 *
 * Casos cubiertos:
 *  - Sin hijos disponibles: mensaje amigable + CTA "Cerrar".
 *  - Cargando (loading=true): skeleton; el CTA se mantiene deshabilitado.
 *  - Hijos sin selección inicial: arranca vacío; usuario elige.
 *  - Hijos con selección inicial (edit): se precarga.
 *  - El padre siempre recibe la composición al confirmar y arma el
 *    CartItem. El modal NO agrega directo al carrito.
 */
export default function ContainerModal({
  open,
  onClose,
  mode = 'add',
  product,
  config,
  children,
  initialComposition,
  parentLineId: _parentLineId,
  loading = false,
  onConfirm,
}: ContainerModalProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [lines, setLines] = useState<CompositionLine[]>(
    () =>
      (initialComposition ?? []).map((l) => ({
        child_product_id: l.child_product_id,
        qty: l.qty,
      })) ?? []
  );
  const [price, setPrice] = useState<number>(0);
  const [attempted, setAttempted] = useState(false);

  // Reset state interno cada vez que (re)abrimos.
  useEffect(() => {
    if (!open) return;
    setAttempted(false);
    setLines(
      (initialComposition ?? []).map((l) => ({
        child_product_id: l.child_product_id,
        qty: l.qty,
      }))
    );
  }, [open, initialComposition]);

  // Focus en cerrar + ESC + scroll lock.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const handleChange = useCallback(
    (nextLines: CompositionLine[], nextPrice: number) => {
      setLines(nextLines);
      setPrice(nextPrice);
    },
    []
  );

  if (!open) return null;

  const cap = effectiveCapacity(config);
  const minU = effectiveMinUnits(config);
  // Si la config no tiene capacidad ni max, usamos minU como tope "dummy"
  // sólo para que la UI compile; el panel real (ContainerCompositionList)
  // ya muestra el warning de "Configuración incompleta".
  const effectiveCap = cap ?? minU;
  const maxU = config.container_max_units ?? effectiveCap;
  const requireFull = !!config.container_require_full;
  const total = totalUnits(lines);
  const validation = validateComposition(config, children, lines);
  // Si no hay capacidad válida, el modal nunca puede confirmar (el
  // configurador hijo ya muestra el warning). Forzamos isValid=false.
  const isValid =
    cap != null && validation.ok && total >= minU && total <= maxU;
  const computed = computeContainerPrice(
    config,
    product.price,
    children,
    lines,
    product.currency
  );
  const displayPrice = price > 0 || lines.length > 0 ? price : computed.total;

  const headingId = 'container-modal-title';
  const eyebrow =
    mode === 'edit'
      ? `Editar tu ${product.name.toLowerCase()}`
      : product.name;
  const heading =
    mode === 'edit'
      ? 'Revisá y editá tu selección'
      : 'Armá tu caja con tus alfajores favoritos';
  const subheading =
    mode === 'edit'
      ? 'Modificá lo que elegiste o confirmá para mantener tu configuración.'
      : cap == null
      ? 'La caja todavía no fue configurada correctamente. Escribinos por WhatsApp para armarla a tu medida.'
      : requireFull
      ? `Elegí ${cap} unidades entre las variedades disponibles.`
      : `Elegí entre ${minU} y ${cap} unidades. Combiná libremente las variedades.`;
  // ¿El contenedor tiene precio fijo independiente del contenido?
  // price_mode = 'replace' hace que el total sea siempre container_base_price.
  const isFixedPrice = config.price_mode === 'replace';
  const ctaLabel =
    mode === 'edit'
      ? 'Guardar cambios'
      : cap == null
      ? 'Configuración incompleta'
      : requireFull
      ? total === cap
        ? `Confirmar selección · ${formatMoney(displayPrice, product.currency)}`
        : `Te falta${cap - total === 1 ? '' : 'n'} ${cap - total} para completar`
      : isValid
      ? `Confirmar selección · ${formatMoney(displayPrice, product.currency)}`
      : `Elegí al menos ${minU}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
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
          'relative w-full overflow-hidden bg-bone text-ink',
          'rounded-t-[18px] sm:rounded-[18px] sm:max-w-4xl',
          'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_64px_-16px_rgba(0,0,0,0.35)]',
          'border border-gold/20',
          // En mobile hacemos scroll al panel entero; en desktop el
          // resumen lateral es sticky y el catálogo scrollea adentro.
          'max-h-[92vh] flex flex-col',
        ].join(' ')}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 pt-6 pb-4 sm:px-8 sm:pt-7 sm:pb-5 shrink-0">
          <div>
            <p className="text-eyebrow text-gold-deep">{eyebrow}</p>
            <h2
              id={headingId}
              className="mt-2 font-display text-2xl leading-tight text-ink sm:text-3xl font-light"
            >
              {heading}
            </h2>
            <p className="mt-2 max-w-prose font-body text-sm text-ink/70">
              {subheading}
            </p>
          </div>
          <button
            ref={closeRef}
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

        {/* Body — 2-col en md+; en mobile todo apilado */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid gap-4 px-5 py-5 sm:px-8 sm:py-6">
              <div className="h-2 w-full animate-pulse rounded-full bg-ink/10" />
              <div className="grid gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex animate-pulse items-center gap-4 rounded-md border border-ink/10 bg-cream px-4 py-3"
                  >
                    <div className="h-16 w-16 rounded-md bg-ink/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded bg-ink/10" />
                      <div className="h-2 w-1/4 rounded bg-ink/10" />
                    </div>
                    <div className="h-10 w-24 rounded-full bg-ink/10" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              {/* COLUMNA IZQ — catálogo */}
              <div className="border-b border-ink/10 px-5 py-5 sm:px-8 sm:py-6 md:border-b-0 md:border-r">
                <ContainerCompositionList
                  product={product}
                  config={config}
                  children={children}
                  initialComposition={
                    initialComposition?.map((l) => ({
                      child_product_id: l.child_product_id,
                      qty: l.qty,
                    })) ?? []
                  }
                  onChange={handleChange}
                  showTotal={false}
                  showConfirmButton={false}
                  showFooterHint={false}
                  attemptSubmit={attempted}
                  hideUnitPrice={isFixedPrice}
                />
                {attempted && !isValid && children.length > 0 && (
                  <ul className="mt-4 space-y-1 rounded-md border border-red-200 bg-red-50/80 px-3 py-2 font-body text-xs text-red-700">
                    {validation.errors.length === 0 ? (
                      <li>
                        • Elegí al menos {minU}{' '}
                        {minU === 1 ? 'unidad' : 'unidades'} para confirmar.
                      </li>
                    ) : (
                      validation.errors.map((e, i) => <li key={i}>• {e}</li>)
                    )}
                  </ul>
                )}
              </div>

              {/* COLUMNA DER — resumen sticky */}
              <div className="bg-cream/60 px-5 py-5 sm:px-8 sm:py-6 md:sticky md:top-0 md:max-h-[calc(92vh-120px)] md:overflow-y-auto">
                <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
                  Tu selección
                </p>
                {total === 0 ? (
                  <p className="mt-3 font-body text-sm leading-relaxed text-ink/60">
                    Todavía no elegiste nada. Sumá unidades desde el catálogo
                    para empezar.
                  </p>
                ) : isFixedPrice ? (
                  // Modo 'replace': el precio es fijo. Mostramos las
                  // cantidades elegidas sin desglose de precio por unidad.
                  <ul className="mt-3 space-y-2 font-body text-sm text-ink/85">
                    {lines.map((l) => {
                      const child = children.find(
                        (c) => c.product.id === l.child_product_id
                      );
                      return (
                        <li
                          key={l.child_product_id}
                          className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2 last:border-b-0 last:pb-0"
                        >
                          <span className="min-w-0">
                            <span className="font-display text-base text-gold-deep">
                              {l.qty} ×
                            </span>{' '}
                            {child?.product.name ?? l.child_product_id}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="mt-3 space-y-2 font-body text-sm text-ink/85">
                    {lines.map((l) => {
                      const child = children.find(
                        (c) => c.product.id === l.child_product_id
                      );
                      const amount =
                        (child?.product.price ?? 0) * l.qty;
                      return (
                        <li
                          key={l.child_product_id}
                          className="flex items-center justify-between gap-3 border-b border-ink/10 pb-2 last:border-b-0 last:pb-0"
                        >
                          <span className="min-w-0">
                            <span className="font-display text-base text-gold-deep">
                              {l.qty} ×
                            </span>{' '}
                            {child?.product.name ?? l.child_product_id}
                          </span>
                          <span className="text-ink/70">
                            {formatMoney(
                              amount,
                              child?.product.currency ?? product.currency
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Banner de precio fijo */}
                {isFixedPrice && (
                  <div className="mt-4 flex items-start gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 font-body text-[11px] leading-relaxed text-ink/75">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 shrink-0 text-gold-deep"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M9 12h6M12 9v6" />
                    </svg>
                    <span>
                      <strong className="font-medium">Precio fijo.</strong>{' '}
                      El valor de la caja no varía según los alfajores que
                      elijas adentro.
                    </span>
                  </div>
                )}

                {/* Capacidad */}
                <div
                  className="mt-5 flex items-center justify-between rounded-md border border-gold/30 bg-bone px-3 py-2 font-body text-sm"
                  aria-live="polite"
                >
                  <span className="text-ink/70">
                    {requireFull
                      ? 'Capacidad completa'
                      : 'Unidades en la caja'}
                  </span>
                  <span
                    className={[
                      'font-display text-lg',
                      total >= effectiveCap ? 'text-emerald-700' : 'text-gold-deep',
                    ].join(' ')}
                  >
                    {Math.min(total, effectiveCap)} / {effectiveCap}
                  </span>
                </div>

                {/* Total */}
                <div className="mt-4 flex items-baseline justify-between border-t border-ink/15 pt-4">
                  <span className="font-body text-[10px] uppercase tracking-ultra text-ink/55">
                    Total
                  </span>
                  <span className="font-display text-2xl text-ink">
                    {formatMoney(displayPrice, product.currency)}
                  </span>
                </div>

                {/* CTA */}
                {children.length > 0 && !loading && (
                  <button
                    type="button"
                    disabled={!isValid || loading}
                    onClick={() => {
                      if (!isValid) {
                        setAttempted(true);
                        return;
                      }
                      onConfirm(lines, displayPrice);
                    }}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon disabled:cursor-not-allowed disabled:bg-ink/30 disabled:text-ink/50 disabled:hover:bg-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                  >
                    {ctaLabel}
                    <span aria-hidden>→</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 block w-full text-center font-body text-xs uppercase tracking-ultra text-ink/55 hover:text-ink focus:outline-none focus-visible:underline"
                >
                  {mode === 'edit' ? 'Cancelar' : 'Seguir mirando'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export útil: el padre puede computar el parentLineId estable.
// Usa el MISMO algoritmo que `ProductoDetalle.tsx` y `lib/container-orders.ts:stableHash`,
// para que las ids coincidan entre cliente y server.
export function containerParentLineId(
  productId: string,
  composition: ReadonlyArray<CompositionLine>
): string {
  if (!composition || composition.length === 0) {
    return `cont-${productId}-empty`;
  }
  const key = composition
    .slice()
    .sort((a, b) => a.child_product_id.localeCompare(b.child_product_id))
    .map((l) => `${l.child_product_id}x${l.qty}`)
    .join('|');
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (h * 33) ^ key.charCodeAt(i);
  return `cont-${productId}-${(h >>> 0).toString(36)}`;
}

// Helper textual para el heading del modal.
export function describeModalCapacity(
  cap: number,
  requireFull: boolean,
  min: number
): string {
  if (requireFull) return `elegí ${cap} unidades`;
  if (cap <= 1) return 'elegí 1 producto';
  return `elegí entre ${min} y ${cap} unidades`;
}
