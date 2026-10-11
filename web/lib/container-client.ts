// Cliente-side fetcher del contexto de un producto contenedor.
// Reuso de /api/products/[id]/context — devuelve gallery, isContainer y
// la lista de children con min/max/sort_order.
//
// Se cachea por id (Map en memoria del módulo) durante la vida del
// tab — múltiples componentes que pidan el mismo id sólo disparan un
// request. La API ya devuelve lectura pública vía RLS, sin auth.

import type { ContainerChild, ContainerConfig } from './container';
import type { Product } from './queries-client';

export type ContainerContextResponse = {
  productId: string;
  isContainer: boolean;
  product: Product;
  containerChildren: ContainerChild[];
};

/** El endpoint `/api/products/[id]/context` devuelve un shape parcial
 *  (subset del Product). Este tipo lo modela para que el cliente
 *  pueda armar la ContainerConfig sin tener que hacer otro fetch. */
export type ContainerContextProduct = Pick<
  Product,
  | 'id'
  | 'name'
  | 'image'
  | 'is_container'
  | 'container_base_price'
  | 'price_mode'
  | 'container_capacity'
  | 'container_min_units'
  | 'container_max_units'
  | 'container_require_full'
>;

const inflight = new Map<string, Promise<ContainerContextResponse | null>>();
const cache = new Map<string, ContainerContextResponse | null>();

export async function fetchContainerContext(
  productId: string
): Promise<ContainerContextResponse | null> {
  if (!productId) return null;
  if (cache.has(productId)) return cache.get(productId)!;
  if (inflight.has(productId)) return inflight.get(productId)!;

  const p = (async () => {
    try {
      const res = await fetch(`/api/products/${productId}/context`, {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        isContainer?: boolean;
        product?: ContainerContextProduct;
        containerChildren?: ContainerChild[];
      };
      // El endpoint devuelve los campos container_*. Los mergeamos en un
      // Product "completo" (los demás campos default-eamos) para que
      // configFromProduct() pueda leerlos sin otro fetch.
      const p = data.product;
      const merged: Product = {
        id: p?.id ?? productId,
        name: p?.name ?? '',
        description: '',
        price: 0,
        currency: 'UYU',
        category: '',
        image: p?.image ?? '',
        badge: null,
        is_active: true,
        sort_order: 0,
        units_per_pack: 1,
        nutrition: null,
        is_container: !!data.isContainer,
        container_base_price: p?.container_base_price ?? null,
        price_mode: (p?.price_mode ?? 'base_plus_content') as Product['price_mode'],
        container_capacity: p?.container_capacity ?? null,
        container_min_units: p?.container_min_units ?? 1,
        container_max_units: p?.container_max_units ?? null,
        container_require_full: !!p?.container_require_full,
        can_be_in_container: false,
      };
      const out: ContainerContextResponse = {
        productId,
        isContainer: !!data.isContainer,
        product: merged,
        containerChildren: data.containerChildren ?? [],
      };
      cache.set(productId, out);
      return out;
    } catch {
      cache.set(productId, null);
      return null;
    } finally {
      inflight.delete(productId);
    }
  })();
  inflight.set(productId, p);
  return p;
}

/** Helper: deriva ContainerConfig desde el Product del contexto. */
export function configFromProduct(p: Product | null | undefined): ContainerConfig {
  if (!p) {
    return {
      is_container: false,
      container_base_price: null,
      price_mode: 'base_plus_content',
      container_capacity: null,
      container_min_units: 1,
      container_max_units: null,
      container_require_full: false,
    };
  }
  return {
    is_container: !!p.is_container,
    container_base_price: p.container_base_price ?? null,
    price_mode: (p.price_mode ?? 'base_plus_content') as ContainerConfig['price_mode'],
    container_capacity: p.container_capacity ?? null,
    container_min_units: p.container_min_units ?? 1,
    container_max_units: p.container_max_units ?? null,
    container_require_full: !!p.container_require_full,
  };
}
