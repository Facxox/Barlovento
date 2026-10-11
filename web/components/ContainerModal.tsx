'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ContainerCompositionList from './ContainerCompositionList';
import { formatMoney } from './formatMoney';
import {
  computeContainerPrice,
  effectiveCapacity,
  validateComposition,
  type CompositionLine,
  type ContainerChild,
  type ContainerConfig,
} from '@/lib/container';
import type { Product, CartItemCompositionLine } from '@/lib/queries-client';

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
   * Confirmación. El padre (Tienda / CartDrawer) construye el CartItem
   * con la composición final y llama a `addContainer` o a la action de
   * update.
   */
  onConfirm: (composition: CompositionLine[], total: number) => void;
};

/**
 * Modal reusable para configurar el contenido de un producto contenedor.
 * Mismo shell visual que `MerchUpsellModal` (overlay `bg-carbon/70` +
 * panel `rounded-[18px]` + ESC + scroll lock + focus inicial en cerrar).
 *
 * El configurador interno (`ContainerCompositionList`) detecta solo el
 * modo single-select vs multi-qty según `container_capacity`.
 *
 * Casos cubiertos:
 *  - Sin hijos disponibles: mensaje amigable + CTA "Cerrar".
 *  - Hijos sin selección inicial: arranca vacío; usuario elige.
 *  - Hijos con selección inicial (edit): se precarga.
 *  - Capacidad llena: CTA habilitado, validación server-side ya está
 *    garantizada por `lib/container-orders.ts`.
 */
export default function ContainerModal({
  open,
  onClose,
  mode = 'add',
  product,
  config,
  children,
  initialComposition,
  parentLineId,
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
  const validation = validateComposition(config, children, lines);
  const isValid = validation.ok && lines.length > 0;
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
      ? 'Editar selección'
      : 'Pack personalizable';
  const heading =
    mode === 'edit'
      ? `Revisá el contenido de tu ${product.name.toLowerCase()}`
      : `Personalizá tu ${product.name.toLowerCase()}`;
  const subheading =
    mode === 'edit'
      ? 'Modificá la selección o confirmá para mantener lo que ya elegiste.'
      : 'Elegí qué llevar adentro. Vas a poder cambiarlo desde el carrito las veces que quieras.';
  const ctaLabel =
    mode === 'edit'
      ? 'Guardar cambios'
      : lines.length > 0
      ? `Confirmar y agregar · ${formatMoney(displayPrice, product.currency)}`
      : 'Elegí una opción para continuar';

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
          'relative w-full max-w-3xl overflow-hidden bg-bone text-ink',
          'rounded-t-[18px] sm:rounded-[18px]',
          'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_64px_-16px_rgba(0,0,0,0.35)]',
          'border border-gold/20',
          'max-h-[92vh] overflow-y-auto',
        ].join(' ')}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-7 sm:px-8">
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

        {/* Body */}
        <div className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
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
          />

          {/* Errores visibles cuando el usuario intenta confirmar sin selección válida */}
          {attempted && !isValid && children.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-md border border-red-200 bg-red-50/80 px-3 py-2 font-body text-xs text-red-700">
              {validation.errors.length === 0 ? (
                <li>• Elegí al menos una opción para continuar.</li>
              ) : (
                validation.errors.map((e, i) => <li key={i}>• {e}</li>)
              )}
            </ul>
          )}

          {/* Sin hijos disponibles */}
          {children.length === 0 && (
            <div className="rounded-[10px] border border-ink/10 bg-cream px-4 py-6 text-center font-body text-sm text-ink/70">
              Este producto todavía no tiene opciones configuradas.
              <br />
              <a
                href={`https://wa.me/59899366522?text=${encodeURIComponent(
                  `Hola! Quiero consultar por ${product.name}.`
                )}`}
                target="_blank"
                rel="noopener"
                className="mt-3 inline-block font-body text-[10px] uppercase tracking-ultra text-gold-deep underline-offset-4 hover:underline"
              >
                Consultar por WhatsApp →
              </a>
            </div>
          )}

          {/* Footer con CTA */}
          {children.length > 0 && (
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onClose}
                className="font-body text-xs uppercase tracking-ultra text-ink/60 hover:text-ink focus:outline-none focus-visible:underline"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={() => {
                  if (!isValid) {
                    setAttempted(true);
                    return;
                  }
                  onConfirm(lines, displayPrice);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon disabled:cursor-not-allowed disabled:bg-ink/30 disabled:text-ink/50 disabled:hover:bg-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {ctaLabel}
                <span aria-hidden>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export útil: el padre puede computar el parentLineId estable.
// Importante: usa el MISMO algoritmo que `ProductoDetalle.tsx:63-68`
// y que `lib/container-orders.ts:360-368` (stableHash), para que las
// ids coincidan entre cliente y server.
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

// Helper para mostrar la capacidad efectiva en headings del modal.
export function describeModalCapacity(cap: number, isSingle: boolean): string {
  if (cap <= 0) return 'sin tope';
  if (isSingle) return 'elegí 1 producto';
  return `hasta ${cap} unidades`;
}
