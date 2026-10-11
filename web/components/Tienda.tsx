'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useCart } from './CartContext';
import { Reveal } from './Reveal';
import GoldDivider from './GoldDivider';
import { formatMoney } from './formatMoney';
import ContainerModal, {
  containerParentLineId,
} from './ContainerModal';
import { fetchContainerContext, configFromProduct } from '@/lib/container-client';
import { resolveGallery } from '@/lib/gallery';
import type { Product, Category } from '@/lib/queries';
import type { ProductImage } from '@/lib/gallery';
import type { CompositionLine } from '@/lib/container';
import type { CartItemCompositionLine } from '@/lib/queries-client';

export default function Tienda({
  products,
  categories: allCategories,
  galleryByProduct,
  isWholesale = false,
}: {
  products: Product[];
  categories: Category[];
  galleryByProduct?: Record<string, ProductImage[]>;
  isWholesale?: boolean;
}) {
  const { add, addContainer } = useCart();

  // Estado del modal: cuál producto contenedor se está personalizando.
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalChildren, setModalChildren] = useState<
    import('@/lib/container').ContainerChild[]
  >([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [pendingComposition, setPendingComposition] = useState<
    CompositionLine[] | null
  >(null);
  const [pendingTotal, setPendingTotal] = useState<number>(0);

  const openContainerModal = useCallback(
    async (p: Product) => {
      if (!p.is_container) {
        add({
          id: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          image: p.image,
          unitsPerPack: p.units_per_pack ?? 1,
        });
        return;
      }
      setModalLoading(true);
      setModalProduct(p);
      setModalChildren([]);
      const ctx = await fetchContainerContext(p.id);
      setModalLoading(false);
      if (!ctx || !ctx.product) {
        // Sin contexto, agregamos como producto normal para no bloquear al cliente.
        add({
          id: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          image: p.image,
          unitsPerPack: p.units_per_pack ?? 1,
        });
        setModalProduct(null);
        return;
      }
      setModalChildren(ctx.containerChildren);
    },
    [add]
  );

  const closeContainerModal = useCallback(() => {
    setModalProduct(null);
    setModalChildren([]);
    setPendingComposition(null);
    setPendingTotal(0);
  }, []);

  const handleContainerConfirm = useCallback(
    (composition: CompositionLine[], total: number) => {
      if (!modalProduct) return;
      const parentLineId = containerParentLineId(modalProduct.id, composition);
      const childrenPayload: CartItemCompositionLine[] = composition.map((l) => {
        const child = modalChildren.find(
          (c) => c.product.id === l.child_product_id
        );
        return {
          child_product_id: l.child_product_id,
          child_name: child?.product.name ?? l.child_product_id,
          qty: l.qty,
          unit_price: child?.product.price ?? 0,
          currency: child?.product.currency ?? modalProduct.currency,
          child_image: child?.product.image ?? null,
        };
      });
      const physicalUnits = composition.reduce((a, l) => a + l.qty, 0);
      addContainer({
        kind: 'container',
        id: parentLineId,
        parentLineId,
        name: modalProduct.name,
        price: total,
        currency: modalProduct.currency,
        image: modalProduct.image,
        unitsPerPack: physicalUnits,
        composition: childrenPayload,
        containerPriceTotal: total,
      });
      closeContainerModal();
    },
    [modalProduct, modalChildren, addContainer, closeContainerModal]
  );
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
              galleryImages={galleryByProduct?.[p.id] ?? []}
              labelById={labelById}
              delay={i * 100}
              isWholesale={isWholesale}
              isContainer={!!p.is_container}
              onAdd={() => openContainerModal(p)}
            />
          ))}
        </div>
      </div>

      {/* Modal global de Tienda (uno a la vez) */}
      {modalProduct && (
        <ContainerModal
          open={!!modalProduct}
          onClose={closeContainerModal}
          mode="add"
          product={modalProduct}
          config={configFromProduct(modalProduct)}
          children={modalChildren}
          onConfirm={handleContainerConfirm}
        />
      )}
    </section>
  );
}

function ProductCard({
  product,
  galleryImages,
  labelById,
  delay,
  onAdd,
  isWholesale,
  isContainer,
}: {
  product: Product;
  galleryImages: ProductImage[];
  labelById: Map<string, string>;
  delay: number;
  onAdd: () => void;
  isWholesale: boolean;
  isContainer: boolean;
}) {
  const gallery = resolveGallery(galleryImages, product.image);
  const coverUrl = gallery.primary?.url ?? product.image;
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
              src={coverUrl}
              alt={product.name}
              className="block h-full w-full object-cover"
            />
            {gallery.ordered.length > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-ink/65 px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-cream">
                +{gallery.ordered.length - 1}
              </span>
            )}
            {isContainer && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-gold/95 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-ink shadow-sm">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="6" />
                </svg>
                Pack personalizable
              </span>
            )}
            {!isContainer && product.badge && (
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
            {isContainer
              ? `Desde ${formatMoney(
                  product.container_base_price != null
                    ? product.container_base_price
                    : product.price,
                  product.currency
                )}`
              : formatMoney(product.price, product.currency)}
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onAdd}
            className="flex-1 rounded-full bg-ink px-4 py-3 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon"
          >
            {isContainer ? 'Personalizar y agregar' : 'Agregar'}
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
