'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import NutritionTable from './NutritionTable';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';
import { formatMoney } from './formatMoney';
import ProductGallery from './ProductGallery';
import ContainerConfigurator from './ContainerConfigurator';
import type { Product, Category } from '@/lib/queries';
import { asContainerConfig } from '@/lib/queries-client';
import type { ProductImage } from '@/lib/queries-client';
import type { ContainerChild } from '@/lib/container';
import type { CompositionLine } from '@/lib/container';

export default function ProductoDetalle({
  product,
  categories,
  images,
  containerChildren,
  isWholesale = false,
}: {
  product: Product;
  categories: Category[];
  images?: ProductImage[];
  /** Productos habilitados para colocar dentro del contenedor. Lista
   *  vacía si el producto no es contenedor o si no tiene hijos. */
  containerChildren?: ContainerChild[];
  isWholesale?: boolean;
}) {
  const { add, addContainer } = useCart();
  const [added, setAdded] = useState(false);
  const isContainer = !!product.is_container && !!containerChildren;

  const labelById = new Map(categories.map((c) => [c.id, c.label]));
  const categoryLabel = labelById.get(product.category) ?? product.category;

  const onAdd = () => {
    add({
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: product.image,
      unitsPerPack: product.units_per_pack ?? 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  const config = useMemo(() => asContainerConfig(product), [product]);

  const handleContainerAdd = (
    composition: CompositionLine[],
    total: number
  ) => {
    // parentLineId único y estable para esta configuración particular.
    // NO usamos product.id porque eso fusionaría distintas latas entre
    // sí. Codificamos la composición para que dos personalizaciones
    // distintas sean líneas separadas en el carrito.
    const compositionKey = composition
      .slice()
      .sort((a, b) => a.child_product_id.localeCompare(b.child_product_id))
      .map((l) => `${l.child_product_id}x${l.qty}`)
      .join('|');
    const parentLineId = `cont-${product.id}-${hashKey(compositionKey)}`;

    const childrenPayload = composition.map((l) => {
      const child = (containerChildren ?? []).find(
        (c) => c.product.id === l.child_product_id
      );
      return {
        child_product_id: l.child_product_id,
        child_name: child?.product.name ?? l.child_product_id,
        qty: l.qty,
        unit_price: child?.product.price ?? 0,
        currency: child?.product.currency ?? product.currency,
        child_image: child?.product.image ?? null,
      };
    });

    const totalPhysicalUnits = composition.reduce((a, l) => a + l.qty, 0);

    addContainer({
      kind: 'container',
      id: parentLineId,
      parentLineId,
      name: product.name,
      price: total,
      currency: product.currency,
      image: product.image,
      unitsPerPack: totalPhysicalUnits,
      composition: childrenPayload,
      containerPriceTotal: total,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <section className="bg-cream text-ink py-24 lg:py-32">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-16 lg:px-10">
        <Link
          href="/#tienda"
          className="inline-block font-body text-[10px] uppercase tracking-ultra text-gold-deep hover:text-ink"
        >
          ← Volver a la tienda
        </Link>

        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Galería */}
          <ProductGallery
            images={images ?? []}
            fallbackUrl={product.image || null}
            productName={product.name}
          />

          {/* Info + acciones / configurador */}
          <Reveal delay={120}>
            <div>
              <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
                {categoryLabel}
                {product.badge && (
                  <span className="ml-3 rounded-full border border-gold/70 px-2 py-0.5 text-ink">
                    {product.badge}
                  </span>
                )}
              </p>
              <h1 className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl font-light">
                {product.name}
              </h1>
              {!isContainer && (
                <p className="mt-4 font-display text-3xl text-ink/90">
                  {formatMoney(product.price, product.currency)}
                </p>
              )}

              <p className="mt-8 max-w-xl font-body text-base leading-[1.85] text-ink/80">
                {product.description}
              </p>

              {/* Si NO es contenedor, mostramos el botón clásico. */}
              {!isContainer && (
                <div className="mt-10 flex flex-wrap gap-3">
                  <button
                    onClick={onAdd}
                    className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon"
                  >
                    {added ? 'Agregado ✓' : 'Agregar al carrito'}
                    {!added && (
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    )}
                  </button>
                  <a
                    href={`https://wa.me/59899366522?text=${encodeURIComponent(
                      `Hola! Quiero consultar por ${product.name}.`
                    )}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-3 rounded-full border border-ink/40 px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-ink hover:border-ink"
                  >
                    Consultar por WhatsApp
                  </a>
                </div>
              )}

              {added && (
                <p className="mt-3 font-body text-xs text-emerald-700">
                  {isContainer
                    ? 'Personalización agregada al carrito.'
                    : 'Producto agregado al carrito.'}
                </p>
              )}
            </div>
          </Reveal>
        </div>

        {/* Configurador — debajo de la grilla para tener espacio */}
        {isContainer && (
          <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <Reveal delay={120}>
              <div className="border border-ink/15 bg-bone p-6">
                <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
                  Acerca del contenedor
                </p>
                <h3 className="mt-2 font-display text-2xl text-ink">
                  Cómo funciona
                </h3>
                <ul className="mt-4 space-y-3 font-body text-base text-ink/80 leading-relaxed">
                  <li className="flex gap-3">
                    <span aria-hidden className="text-gold-deep font-display text-lg leading-none">1</span>
                    <span>
                      Elegí hasta {config.container_capacity ?? 'los'} unidad
                      {(config.container_capacity ?? 1) === 1 ? '' : 'es'} de los
                      productos disponibles para llenar este contenedor.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span aria-hidden className="text-gold-deep font-display text-lg leading-none">2</span>
                    <span>
                      El precio final se calcula con el modo configurado por el
                      productor. Verás el desglose en tiempo real.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span aria-hidden className="text-gold-deep font-display text-lg leading-none">3</span>
                    <span>
                      Una vez completa tu selección, agregá el contenedor al
                      carrito. Podés armar varias latas con combinaciones
                      distintas — cada una es una línea independiente.
                    </span>
                  </li>
                </ul>
              </div>
            </Reveal>

            <ContainerConfigurator
              product={product}
              config={config}
              children={containerChildren ?? []}
              onAddToCart={handleContainerAdd}
            />
          </div>
        )}

        {/* Tabla nutricional — debajo de la imagen y la descripción */}
        {product.nutrition && (
          <Reveal delay={180}>
            <div className="mt-16 max-w-2xl border border-ink/15 bg-bone">
              <div className="border-b border-ink/15 px-6 py-4">
                <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
                  Información nutricional
                </p>
                <p className="mt-1 font-body text-xs text-ink/55">
                  Valores por porción. % VD basado en una dieta de 2.000 kcal.
                </p>
              </div>
              <NutritionTable data={product.nutrition} />
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/**
 * Hash determinístico no-crypto para generar un id corto para la
 * composición. Suficiente para distinguir configuraciones distintas
 * en localStorage y cart_container_compositions.parent_line_id.
 */
function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
