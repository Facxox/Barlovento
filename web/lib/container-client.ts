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
        product?: Product;
        containerChildren?: ContainerChild[];
      };
      const out: ContainerContextResponse = {
        productId,
        isContainer: !!data.isContainer,
        product: data.product as Product,
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
