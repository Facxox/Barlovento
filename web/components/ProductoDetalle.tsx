'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import NutritionTable from './NutritionTable';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';
import type { Product, Category } from '@/lib/queries';

const formatUY = (n: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(n);

export default function ProductoDetalle({
  product,
  categories,
  isWholesale = false,
}: {
  product: Product;
  categories: Category[];
  isWholesale?: boolean;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const labelById = new Map(categories.map((c) => [c.id, c.label]));
  const categoryLabel = labelById.get(product.category) ?? product.category;

  const onAdd = () => {
    add({
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: product.image,
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
          {/* Imagen */}
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.image}
                alt={product.name}
                className="block h-full w-full object-cover"
              />
              {product.badge && (
                <span className="absolute left-4 top-4 inline-flex items-center rounded-full border border-gold/70 bg-cream/90 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-ink">
                  {product.badge}
                </span>
              )}
            </div>
          </Reveal>

          {/* Info + acciones */}
          <Reveal delay={120}>
            <div>
              <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
                {categoryLabel}
              </p>
              <h1 className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl font-light">
                {product.name}
              </h1>
              <p className="mt-4 font-display text-3xl text-ink/90">
                {formatUY(product.price)}
              </p>

              <p className="mt-8 max-w-xl font-body text-base leading-[1.85] text-ink/80">
                {product.description}
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <button
                  onClick={onAdd}
                  className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon"
                >
                  {added
                  ? isWholesale
                    ? 'Agregado ✓'
                    : 'Agregado ✓'
                  : isWholesale
                    ? 'Agregar al carrito'
                    : 'Agregar al carrito'}
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

              {added && (
                <p className="mt-3 font-body text-xs text-emerald-700">
                  {isWholesale
                    ? 'Te derivaremos a WhatsApp para coordinar el pedido mayorista.'
                    : 'Producto agregado al carrito.'}
                </p>
              )}
            </div>
          </Reveal>
        </div>

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
