'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCart } from './CartContext';
import { Reveal } from './Reveal';
import { formatMoney } from './formatMoney';
import type { ContainerChild, ContainerConfig, Product } from '@/lib/types-public';
import {
  effectiveCapacity,
  effectiveMinUnits,
  validateComposition,
  computeContainerPrice,
} from '@/lib/container';
import type { CompositionLine } from '@/lib/container';

/**
 * Configurador visual para productos contenedores.
 *
 * Recibe:
 *   - product: el producto contenedor (con is_container = true)
 *   - config:  config validada del contenedor
 *   - children: productos disponibles para colocar (con min_qty/max_qty)
 *   - onAddToCart: el padre arma el CartItem con composición. Lo exponemos
 *     en vez de llamar useCart() directo para mantener este componente
 *     desacoplado y testeable.
 *
 * Comportamiento:
 *   - Muestra la capacidad y el progreso ("4 / 6").
 *   - Tarjetas con imagen, nombre, precio.
 *   - Botones +/- respetando min/max por child y capacidad global.
 *   - Precio total reactivo con desglose.
 *   - CTA "Agregar al carrito" deshabilitado si la composición no es válida.
 *   - Resumen visible arriba (lista de productos seleccionados).
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
  const cap = effectiveCapacity(config);
  const minU = effectiveMinUnits(config);
  const maxU = config.container_max_units ?? cap;

  // Estado: child_id -> qty (0 por defecto). Inicializamos respetando el
  // min_qty de cada hijo cuando es >0, así el admin que defina "mínimo 2"
  // muestra el contador en 2 desde el arranque.
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const c of children) {
      init[c.product.id] = c.min_qty > 0 ? c.min_qty : 0;
    }
    return init;
  });
  const [attempted, setAttempted] = useState(false);

  const lines: CompositionLine[] = useMemo(() => {
    return Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([child_product_id, n]) => ({ child_product_id, qty: n }));
  }, [qty]);

  const totalUnits = lines.reduce((a, l) => a + l.qty, 0);
  const remaining = Math.max(0, cap - totalUnits);

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

  // Si la lista de children cambia (poco probable, pero defensivo),
  // sincronizamos el estado inicial para que no queden keys muertas.
  useEffect(() => {
    setQty((prev) => {
      const next: Record<string, number> = {};
      for (const c of children) {
        next[c.product.id] = prev[c.product.id] ?? (c.min_qty > 0 ? c.min_qty : 0);
      }
      return next;
    });
  }, [children]);

  // Cantidad total que el cliente lleva al carrito. El contenedor mismo
  // cuenta como 1 línea con multiplicador qty. Las unidades físicas
  // (Σ qty por child) valen para cálculo de envío.
  const totalPhysicalUnits = totalUnits;

  const inc = (c: ContainerChild) => {
    setQty((prev) => {
      const cur = prev[c.product.id] ?? 0;
      if (cur >= cap) return prev;
      if (c.max_qty != null && cur >= c.max_qty) return prev;
      // No permitir sumar más allá de la capacidad global
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

  const canAdd = validation.ok && totalUnits >= minU && totalUnits <= maxU;

  return (
    <Reveal delay={140}>
      <section
        aria-labelledby="container-config-heading"
        className="border border-ink/15 bg-bone"
      >
        <header className="border-b border-ink/15 px-5 py-4">
          <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
            Personalizá tu {product.name}
          </p>
          <h3
            id="container-config-heading"
            className="mt-1 font-display text-xl text-ink"
          >
            Elegí qué llevar adentro
          </h3>
          <p className="mt-2 font-body text-xs text-ink/65">
            Tu {product.name.toLowerCase()}:{' '}
            <span
              className={[
                'font-display text-base',
                totalUnits === cap ? 'text-emerald-700' : 'text-gold-deep',
              ].join(' ')}
            >
              {totalUnits} de {cap}
            </span>
            {remaining > 0 && (
              <span className="text-ink/55">
                {' '}· te faltan {remaining} unidad{remaining === 1 ? '' : 'es'}
              </span>
            )}
            {remaining === 0 && (
              <span className="text-emerald-700"> · ¡completa!</span>
            )}
          </p>
          {config.container_require_full && totalUnits < cap && (
            <p className="mt-2 rounded-sm bg-amber-50 px-3 py-2 font-body text-[11px] text-amber-800 border border-amber-200">
              Este contenedor requiere que completes las {cap} unidades antes
              de agregarlo al carrito.
            </p>
          )}
        </header>

        {/* Lista de hijos */}
        <ul className="divide-y divide-ink/10">
          {children.map((c) => {
            const cur = qty[c.product.id] ?? 0;
            const disabledAdd =
              cur >= cap ||
              (c.max_qty != null && cur >= c.max_qty) ||
              totalUnits >= cap;
            const disabledDec = cur <= 0;
            return (
              <li key={c.product.id} className="flex items-center gap-4 px-5 py-4">
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
                    {formatMoney(c.product.price, c.product.currency)}{' '}
                    {c.product.currency} c/u
                    {c.min_qty > 0 && (
                      <span className="ml-2 text-ink/50">
                        · mín {c.min_qty}
                      </span>
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
                  <span className="w-7 text-center font-display text-lg text-ink">
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

        {children.length === 0 && (
          <p className="px-5 py-6 font-body text-sm text-ink/60">
            Este contenedor todavía no tiene productos habilitados. Avisános
            por WhatsApp y lo armamos a tu gusto.
          </p>
        )}

        {/* Resumen y CTA */}
        <div className="border-t border-ink/15 px-5 py-5 space-y-4">
          {lines.length > 0 && (
            <ul className="space-y-1.5 font-body text-sm text-ink/80">
              {price.breakdown.map((b, i) => (
                <li key={i} className="flex justify-between">
                  <span>{b.label}</span>
                  <span className="text-ink/70">{formatMoney(b.amount, price.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
            <span className="font-body text-[10px] uppercase tracking-ultra text-ink/55">
              Total
            </span>
            <span className="font-display text-2xl text-ink">
              {formatMoney(price.total, price.currency)}
            </span>
          </div>

          {attempted && !canAdd && validation.errors.length > 0 && (
            <ul className="space-y-1 rounded-sm border border-red-200 bg-red-50 px-3 py-2 font-body text-xs text-red-700">
              {validation.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={!canAdd || children.length === 0 || totalUnits < minU}
            onClick={() => {
              setAttempted(true);
              if (!canAdd) return;
              onAddToCart(lines, price.total);
            }}
            className="block w-full rounded-full bg-ink px-6 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon disabled:cursor-not-allowed disabled:bg-ink/30 disabled:text-ink/50 disabled:hover:bg-ink/30"
          >
            Agregar al carrito
          </button>

          {/* help block: aclarar unidades físicas (que afectan envío) */}
          {totalPhysicalUnits > 0 && (
            <p className="text-center font-body text-[11px] text-ink/55">
              Esta configuración pesa {totalPhysicalUnits} alfajor
              {totalPhysicalUnits === 1 ? '' : 'es'} para el cálculo de envío.
            </p>
          )}
        </div>
      </section>
    </Reveal>
  );
}
