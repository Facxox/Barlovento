// Helpers + tipos seguros para componentes 'use client'.
//
// queries.ts usa `import 'server-only'` y no puede ser importado desde
// client components. Este archivo expone sólo tipos puros + funciones
// puras reexportadas de lib/gallery y lib/container (que NO tienen
// server-only), sin tocar Supabase ni queries.
//
// Importante: NO reexportamos de './queries' — Next.js lo toma como
// dependencia de runtime y dispara el error de server-only. Definimos
// los tipos Producto/Category/etc. manualmente acá o los importamos de
// archivos que sí pueden vivir en cliente.

export { resolveGallery } from './gallery';
export {
  effectiveCapacity,
  effectiveMinUnits,
  validateComposition,
  computeContainerPrice,
} from './container';
export type {
  ContainerConfig,
  ContainerChild,
  CompositionLine,
  PriceMode,
  ContainerPricing,
  ContainerValidation,
  ProductRef,
} from './container';
export type { ProductImage } from './gallery';

import type { Nutrition } from './nutrition-types';
export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  image: string;
  badge: string | null;
  is_active: boolean;
  sort_order: number;
  units_per_pack: number;
  nutrition: Nutrition | null;
  is_container?: boolean;
  container_base_price?: number | null;
  price_mode?: import('./container').PriceMode;
  container_capacity?: number | null;
  container_min_units?: number;
  container_max_units?: number | null;
  container_require_full?: boolean;
  can_be_in_container?: boolean;
};
export type Category = {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};
export type GalleryItem = {
  id: number;
  title: string;
  category: string;
  image: string;
  sort_order: number;
};
export type BarloventoEvent = {
  id: number;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
  images: string[];
  kind: 'upcoming' | 'past';
};
export type SiteContent = {
  historia: { eyebrow: string; headline: string; body: string[]; image: string; image_caption: string | null; images: { url: string; caption: string | null }[] };
  hero: { eyebrow: string; headline: string; intro: string; cta_label: string; cta_href: string; background_image: string };
  mision: { eyebrow: string; headline: string; body: string };
  vision:  { eyebrow: string; headline: string; body: string };
  valores: { eyebrow: string; headline: string; items: { title: string; body: string }[] };
  puntos_venta: { eyebrow: string; headline: string; intro: string; departamentos: string[] };
  regalos_empresariales: { eyebrow: string; headline: string; body: string; items: { title: string; body: string }[]; cta: string };
  mayoristas: { eyebrow: string; headline: string; intro: string; beneficios: string[]; requisitos: string[] };
  contacto: { whatsapp: string; email: string; direccion: string; instagram: string; facebook: string; horarios: string };
};

export { isContainerItem } from '@/components/CartContext';
export type {
  CartItem,
  ContainerCartItem,
  AnyCartItem,
  CartItemCompositionLine,
} from '@/components/CartContext';

export async function fetchProductContext(
  productId: string
): Promise<{
  images: import('./gallery').ProductImage[];
  containerChildren: import('./container').ContainerChild[];
}> {
  try {
    const res = await fetch(`/api/products/${productId}/context`, {
      cache: 'no-store',
    });
    if (!res.ok) return { images: [], containerChildren: [] };
    const data = (await res.json()) as {
      images?: import('./gallery').ProductImage[];
      containerChildren?: import('./container').ContainerChild[];
    };
    return {
      images: data.images ?? [],
      containerChildren: data.containerChildren ?? [],
    };
  } catch {
    return { images: [], containerChildren: [] };
  }
}

/** Normaliza un Product (definido acá) a ContainerConfig — pure. */
export function asContainerConfig(p: Product): import('./container').ContainerConfig {
  return {
    is_container: !!p.is_container,
    container_base_price: p.container_base_price ?? null,
    price_mode: (p.price_mode ?? 'base_plus_content') as import('./container').PriceMode,
    container_capacity: p.container_capacity ?? null,
    container_min_units: p.container_min_units ?? 1,
    container_max_units: p.container_max_units ?? null,
    container_require_full: !!p.container_require_full,
  };
}
