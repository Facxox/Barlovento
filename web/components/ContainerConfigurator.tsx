'use client';

import { useCallback, useMemo, useState } from 'react';
import { Reveal } from './Reveal';
import ContainerCompositionList from './ContainerCompositionList';
import ContainerModal, {
  containerParentLineId,
} from './ContainerModal';
import type {
  Product,
  ContainerCartItem,
  CartItemCompositionLine,
} from '@/lib/queries-client';
import type {
  ContainerChild,
  ContainerConfig,
  CompositionLine,
} from '@/lib/container';
import { useCart, isContainerItem } from './CartContext';
import { formatMoney } from './formatMoney';
import {
  effectiveCapacity,
  effectiveMinUnits,
  validateComposition,
} from '@/lib/container';

/**
 * Configurador para productos contenedores (ficha del producto).
 *
 * Antes era una sección al final de la ficha con protagonismo modesto.
 * Ahora:
 *
 *   - Ocupa ancho completo (full bleed dentro del container).
 *   - Header grande con eyebrow "Personalizá el contenido de tu
 *     producto" + progreso destacado.
 *   - Reusa `ContainerCompositionList`, que automáticamente detecta el
 *     modo single-select (capacity=1, default del proyecto).
 *
 * El botón "Agregar al carrito" sigue funcionando como antes; además,
 * una vez hay una composición válida se muestra un CTA secundario
 * "Revisar selección en un modal" que abre el `ContainerModal`
 * prellenado. Esto cubre "el cliente no debe perder su selección al
 * pasar por el modal".
 */
export default function ContainerConfigurator({
  product,
  config,
  children,
  onAddToCart,
}: {
  product: Product;
  config: ContainerConfig;
  children: ContainerChild[];
  onAddToCart: (composition: CompositionLine[], total: number) => void;
}) {
  const { add, updateComposition } = useCart();

  // Estado controlado de la composición para esta ficha.
  const [composition, setComposition] = useState<CompositionLine[]>([]);
  const [total, setTotal] = useState<number>(product.price);
  const [attempted, setAttempted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const cap = effectiveCapacity(config);

  const handleChange = useCallback(
    (lines: CompositionLine[], nextPrice: number) => {
      setComposition(lines);
      setTotal(nextPrice);
    },
    []
  );

  const totalUnits = composition.reduce((a, l) => a + l.qty, 0);
  const minU = effectiveMinUnits(config);
  const maxU = config.container_max_units ?? cap;
  const isValidComposition = validateComposition(config, children, composition).ok;
  const canAdd =
    isValidComposition && totalUnits >= minU && totalUnits <= maxU;

  const handleAdd = () => {
    setAttempted(true);
    if (!canAdd) return;
    onAddToCart(composition, total);
  };

  // Construimos el parentLineId estable para pasárselo al modal.
  const previewParentLineId = useMemo(
    () => containerParentLineId(product.id, composition),
    [product.id, composition]
  );

  return (
    <Reveal delay={140}>
      <section
        aria-labelledby="container-config-heading"
        className="border-y-2 border-gold/30 bg-bone"
      >
        <header className="border-b border-ink/15 px-5 py-6 sm:px-10 sm:py-8">
          <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
            Personalizá el contenido de tu producto
          </p>
          <h2
            id="container-config-heading"
            className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl font-light"
          >
            Armá tu {product.name.toLowerCase()} a tu gusto
          </h2>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-ink/70">
            Elegí qué llevar adentro. Vas a ver el desglose y el precio en
            tiempo real antes de agregarlo al carrito. Si después querés
            cambiarlo, podés editarlo desde el carrito las veces que quieras.
          </p>
        </header>

        <ContainerCompositionList
          product={product}
          config={config}
          children={children}
          composition={composition}
          onChange={handleChange}
          showTotal
          showConfirmButton={false}
          showFooterHint={false}
          attemptSubmit={attempted}
        />

        {/* Footer con CTA principal + CTA secundario al modal */}
        <div className="border-t border-ink/15 px-5 py-6 sm:px-10 sm:py-7 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body text-[10px] uppercase tracking-ultra text-ink/55">
                {composition.length > 0 ? 'Tu configuración' : 'Sin selección aún'}
              </p>
              <p className="mt-1 font-display text-2xl text-ink">
                {formatMoney(
                  composition.length > 0 ? total : product.price,
                  product.currency
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {composition.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/40 px-6 py-3 font-body text-xs uppercase tracking-ultra text-ink transition hover:border-ink hover:bg-ink hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  Revisar selección
                </button>
              )}
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon disabled:cursor-not-allowed disabled:bg-ink/30 disabled:text-ink/50 disabled:hover:bg-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                Agregar al carrito
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>

          {composition.length > 0 && (
            <p className="text-center font-body text-[11px] text-ink/55">
              Esta configuración pesa {composition.reduce((a, l) => a + l.qty, 0)}{' '}
              alfajor
              {composition.reduce((a, l) => a + l.qty, 0) === 1 ? '' : 'es'} para
              el cálculo de envío.
            </p>
          )}
        </div>
      </section>

      {/* Modal secundario para revisar / ajustar la selección. */}
      <ContainerModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mode="edit"
        product={product}
        config={config}
        children={children}
        initialComposition={composition.map((l) => {
          const child = children.find((c) => c.product.id === l.child_product_id);
          return {
            child_product_id: l.child_product_id,
            child_name: child?.product.name ?? l.child_product_id,
            qty: l.qty,
            unit_price: child?.product.price ?? 0,
            currency: child?.product.currency ?? product.currency,
            child_image: child?.product.image ?? null,
          } as CartItemCompositionLine;
        })}
        parentLineId={previewParentLineId}
        onConfirm={(lines, newTotal) => {
          setComposition(lines);
          setTotal(newTotal);
          setShowModal(false);
        }}
      />
    </Reveal>
  );
}
