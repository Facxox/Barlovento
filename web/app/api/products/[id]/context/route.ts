import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { resolveGallery } from '@/lib/gallery';
import type { ProductImage } from '@/lib/gallery';
import type { ContainerChild } from '@/lib/container';

/**
 * GET /api/products/[id]/context
 *
 * Devuelve la información adicional que la ficha de producto necesita:
 *   - `images`: galería ordenada (primary primero).
 *   - `containerChildren`: productos habilitados como contenido del
 *     contenedor, enriquecidos con su info básica (name, price, image).
 *
 * Lectura pública. RLS ya filtra correctamente:
 *   - product_images.public_read: TRUE
 *   - product_container_items.public_read: TRUE
 *   - products.public_read: is_active = TRUE (para join children)
 *     (los hijos se filtran adicionalmente con can_be_in_container = true
 *      y is_active = true en el helper)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;
  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'db_unavailable' },
      { status: 503 }
    );
  }

  const [imagesRes, productRes, containerRes] = await Promise.all([
    supabase
      .from('product_images')
      .select('id, product_id, url, alt, sort_order, is_primary')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select(
        'id, name, image, is_container, can_be_in_container, container_base_price, price_mode, container_capacity, container_min_units, container_max_units, container_require_full'
      )
      .eq('id', productId)
      .maybeSingle(),
    supabase
      .from('product_container_items')
      .select(
        'child_product_id, min_qty, max_qty, sort_order, child:products!product_container_items_child_product_id_fkey(id, name, price, currency, image, is_active, can_be_in_container)'
      )
      .eq('container_product_id', productId)
      .order('sort_order', { ascending: true }),
  ]);

  type RawImage = {
    id: number;
    url: string;
    alt: string | null;
    sort_order: number;
    is_primary: boolean;
  };
  const rawImages: RawImage[] = ((imagesRes.data ?? []) as RawImage[]) || [];
  const images: ProductImage[] = rawImages.map((r) => ({
    id: r.id,
    url: r.url,
    alt: r.alt,
    sort_order: r.sort_order,
    is_primary: r.is_primary,
  }));

  const product = productRes.data as
    | {
        id: string;
        name: string;
        image: string;
        is_container: boolean;
        can_be_in_container: boolean;
        container_base_price: number | null;
        price_mode: string | null;
        container_capacity: number | null;
        container_min_units: number | null;
        container_max_units: number | null;
        container_require_full: boolean;
      }
    | null;

  const fallbackUrl = product?.image ?? null;
  const gallery = resolveGallery(images, fallbackUrl);

  let containerChildren: ContainerChild[] = [];
  if (containerRes.data) {
    type ItemRow = {
      child_product_id: string;
      min_qty: number;
      max_qty: number | null;
      sort_order: number;
      child: {
        id: string;
        name: string;
        price: number;
        currency: string;
        image: string | null;
        is_active: boolean;
        can_be_in_container: boolean;
      } | Array<{
        id: string;
        name: string;
        price: number;
        currency: string;
        image: string | null;
        is_active: boolean;
        can_be_in_container: boolean;
      }> | null;
    };
    for (const r of containerRes.data as ItemRow[]) {
      const child = Array.isArray(r.child) ? r.child[0] : r.child;
      if (!child) continue;
      if (!child.is_active) continue;
      if (!child.can_be_in_container) continue;
      containerChildren.push({
        product: {
          id: child.id,
          name: child.name,
          price: Number(child.price),
          currency: child.currency,
          image: child.image ?? null,
          is_active: true,
        },
        min_qty: r.min_qty ?? 0,
        max_qty: r.max_qty ?? null,
        sort_order: r.sort_order ?? 0,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    productId,
    gallery: {
      ordered: gallery.ordered,
      primary: gallery.primary,
      fallbackUrl: gallery.fallbackUrl,
    },
    images: images,
    // Subset del producto con los campos container_* que el
    // configurador del storefront necesita para calcular capacidad /
    // mínimos / máximos / precio base sin tener que hacer un fetch
    // adicional. Sin este bloque, effectiveCapacity() cae al fallback
    // de "1 unidad" cuando lo correcto es la capacidad real.
    product: product
      ? {
          id: product.id,
          name: product.name,
          image: product.image,
          is_container: product.is_container,
          can_be_in_container: product.can_be_in_container,
          container_base_price: product.container_base_price,
          price_mode: product.price_mode,
          container_capacity: product.container_capacity,
          container_min_units: product.container_min_units,
          container_max_units: product.container_max_units,
          container_require_full: product.container_require_full,
        }
      : null,
    isContainer: !!product?.is_container,
    containerChildren,
  });
}
