'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCart } from './CartContext';
import { Reveal } from './Reveal';
import GoldDivider from './GoldDivider';
import type { Product, Category } from '@/lib/queries';

const formatUY = (n: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(n);

export default function Tienda({
  products,
  categories: allCategories,
  isWholesale = false,
}: {
  products: Product[];
  categories: Category[];
  isWholesale?: boolean;
}) {
  const { add } = useCart();
  // Solo categorías activas que tienen al menos un producto activo. Si el
  // admin borró una categoría, los productos quedan con su slug en products
  // pero no aparece como filtro (mantiene el storefront limpio).
  const usedSlugs = useMemo(
    () => Array.from(new Set(products.filter((p) => p.is_active).map((p) => p.category))),
    [products]
  );
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of allCategories) m.set(c.id, c.label);
    return m;
  }, [allCategories]);
  const filterOptions = useMemo(() => {
    const visible = allCategories
      .filter((c) => c.is_active && usedSlugs.includes(c.id))
      .sort((a, b) => a.sort_order - b.sort_order);
    // Huérfanas: productos con category que no está en la tabla de categorías
    // (ej: admin la borró). Las mostramos al final para que el cliente no
    // pierda acceso al producto.
    const orphanSlugs = usedSlugs.filter((s) => !labelById.has(s));
    const orphanChips = orphanSlugs.map((s) => ({ id: s, label: s }));
    return [{ id: 'todos', label: 'Todos' }, ...visible, ...orphanChips];
  }, [allCategories, usedSlugs, labelById]);
  const [filter, setFilter] = useState<string>('todos');

  const filtered = useMemo(
    () =>
      products
        .filter((p) => p.is_active)
        .filter((p) => filter === 'todos' || p.category === filter)
        .sort((a, b) => a.sort_order - b.sort_order),
    [products, filter]
  );

  return (
    <section id="tienda" className="bg-cream text-ink py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-24 lg:px-10">
        <Reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-eyebrow text-gold-deep">
                {isWholesale ? 'Tienda mayorista' : 'Tienda online'}
              </p>
              <h2 className="mt-5 h-section text-ink">
                {isWholesale
                  ? 'Coordiná tu pedido mayorista por WhatsApp.'
                  : 'Pedí online o por WhatsApp.'}
              </h2>
              <p className="mt-4 text-ink/70 font-body leading-relaxed">
                {isWholesale
                  ? 'Mostramos los precios y productos disponibles para tu cuenta mayorista. Coordinamos el pedido y la entrega directamente por WhatsApp.'
                  : 'Hacemos envíos a todo el país por encomienda, a cargo del cliente. Coordinamos el despacho apenas confirmamos el pago: el envío se abona cuando te llega.'}
              </p>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={[
                    'rounded-full border px-4 py-2 font-body text-xs uppercase tracking-ultra transition',
                    filter === c.id
                      ? 'border-ink bg-ink text-cream'
                      : 'border-ink/20 text-ink/70 hover:border-ink hover:text-ink',
                  ].join(' ')}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              labelById={labelById}
              delay={i * 100}
              isWholesale={isWholesale}
              onAdd={() =>
                add({
                  id: p.id,
                  name: p.name,
                  price: p.price,
                  currency: p.currency,
                  image: p.image,
                })
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  product,
  labelById,
  delay,
  onAdd,
  isWholesale,
}: {
  product: Product;
  labelById: Map<string, string>;
  delay: number;
  onAdd: () => void;
  isWholesale: boolean;
}) {
  return (
    <Reveal delay={delay}>
      <article className="group">
        <Link
          href={`/productos/${product.id}`}
          className="block"
          aria-label={`Ver detalle de ${product.name}`}
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-ink/5 hover-zoom">
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
        </Link>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-[10px] uppercase tracking-ultra text-ink/50">
              {labelById.get(product.category) ?? product.category}
            </p>
            <h3 className="mt-1 font-display text-2xl text-ink leading-tight">
              {product.name}
            </h3>
          </div>
          <p className="font-display text-2xl text-ink/90 whitespace-nowrap">
            {formatUY(product.price)}
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onAdd}
            className="flex-1 rounded-full bg-ink px-4 py-3 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon"
          >
            {isWholesale ? 'Consultar' : 'Agregar'}
          </button>
          <a
            href={`https://wa.me/59899366522?text=${encodeURIComponent(
              `Hola! Quiero consultar por ${product.name}.`
            )}`}
            target="_blank"
            rel="noopener"
            className="grid place-items-center rounded-full border border-ink/30 px-4 text-ink/80 hover:border-ink hover:text-ink transition"
            aria-label="Consultar por WhatsApp"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.05 4.91A10 10 0 0 0 4.1 18.16L3 22l3.93-1.03A10 10 0 1 0 19.05 4.91Zm-7.07 15.45a8.31 8.31 0 0 1-4.24-1.16l-.3-.18-2.33.61.62-2.27-.2-.32a8.32 8.32 0 1 1 6.45 3.32Z" />
            </svg>
          </a>
        </div>
      </article>
    </Reveal>
  );
}
