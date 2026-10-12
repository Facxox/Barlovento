// Cliente-side fetcher del contexto de un producto contenedor.
// Reuso de /api/products/[id]/context — devuelve gallery, isContainer y
// la lista de children con min/max/sort_order, MÁS los campos de
// container config (capacity, min_units, max_units, require_full,
// base_price, price_mode) para que configFromProduct() no caiga al
// fallback 1 cuando faltan.
//
// Cache:
//   - Map en memoria del módulo, con TTL de 30s. Permite que cambios
//     del admin (container_capacity, etc.) se vean pronto sin tener
//     que hacer hard refresh.
//   - Single-flight por id: múltiples componentes que pidan el mismo
//     producto disparan un único fetch.
//   - invalidateContainerContextCache(id) para forzar refresh desde el
//     panel admin después de editar un producto.
//
// La API devuelve lectura pública vía RLS, sin auth.

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

type CacheEntry = {
  value: ContainerContextResponse | null;
  /** Epoch ms cuando se cacheó, para invalidar por TTL. */
  ts: number;
};
const cache = new Map<string, CacheEntry>();

/** TTL del cache: si pasó más de este tiempo, lo revalidamos. Es
 *  importante para que un cambio en admin (container_capacity, etc.)
 *  se vea al recargar la página aunque el módulo JS quede en memoria. */
const CACHE_TTL_MS = 30_000;

function readCache(productId: string): ContainerContextResponse | null | undefined {
  const entry = cache.get(productId);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(productId);
    return undefined;
  }
  return entry.value;
}

function writeCache(productId: string, value: ContainerContextResponse | null) {
  cache.set(productId, { value, ts: Date.now() });
}

/** Invalida manualmente el cache. Útil después de que el admin
 *  modifique la config desde el panel. */
export function invalidateContainerContextCache(productId?: string) {
  if (productId) {
    cache.delete(productId);
    inflight.delete(productId);
  } else {
    cache.clear();
    inflight.clear();
  }
}

export async function fetchContainerContext(
  productId: string
): Promise<ContainerContextResponse | null> {
  if (!productId) return null;
  const cached = readCache(productId);
  if (cached !== undefined) return cached;
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
      const partial = data.product;
      const merged: Product = {
        id: partial?.id ?? productId,
        name: partial?.name ?? '',
        description: '',
        price: 0,
        currency: 'UYU',
        category: '',
        image: partial?.image ?? '',
        badge: null,
        is_active: true,
        sort_order: 0,
        units_per_pack: 1,
        nutrition: null,
        is_container: !!data.isContainer,
        container_base_price: partial?.container_base_price ?? null,
        price_mode: (partial?.price_mode ?? 'base_plus_content') as Product['price_mode'],
        container_capacity: partial?.container_capacity ?? null,
        container_min_units: partial?.container_min_units ?? 1,
        container_max_units: partial?.container_max_units ?? null,
        container_require_full: !!partial?.container_require_full,
        can_be_in_container: false,
      };
      const out: ContainerContextResponse = {
        productId,
        isContainer: !!data.isContainer,
        product: merged,
        containerChildren: data.containerChildren ?? [],
      };
      writeCache(productId, out);
      return out;
    } catch {
      writeCache(productId, null);
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
