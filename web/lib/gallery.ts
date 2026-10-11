// Tipos para galerías de producto (0018_product_images.sql)
//
// Reglas:
//   - Un producto siempre expone una galería de 0..N imágenes ordenadas.
//   - `primary` es una de ellas (la marcada is_primary = true en DB). Si
//     ninguna lo está, se usa la primera por sort_order.
//   - La columna legacy `products.image` se conserva por compatibilidad:
//     si el producto no tiene `product_images`, usamos esa como única
//     imagen (fallback que mantiene andando los productos existentes
//     sin migración manual).

export type ProductImage = {
  id: number;
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type ProductGallery = {
  /** Imágenes efectivamente usadas por el storefront: primary + resto,
   *  ordenadas asc por sort_order. La primary aparece primero. */
  ordered: ProductImage[];
  /** Conveniencia para <img src={primary.url} /> en listados. */
  primary: ProductImage | null;
  /** La imagen que se muestra si no hay galería propia (fallback al
   *  campo legacy `products.image`). */
  fallbackUrl: string | null;
};

/** Resuelve la galería del producto a partir de la lista de imágenes y
 *  el campo legacy `image`. La primary de DB siempre gana; si no hay
 *  ninguna marcada, se devuelve la primera por sort_order; si la lista
 *  está vacía, se devuelve el fallback (string legacy). */
export function resolveGallery(
  images: ProductImage[] | null | undefined,
  fallbackUrl: string | null | undefined
): ProductGallery {
  const list = (images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const primary =
    list.find((i) => i.is_primary) ??
    list[0] ??
    null;
  const fallback =
    fallbackUrl && fallbackUrl.trim().length > 0 ? fallbackUrl : null;

  if (list.length === 0) {
    return {
      ordered: fallback
        ? [
            {
              id: -1,
              url: fallback,
              alt: null,
              sort_order: 0,
              is_primary: true,
            },
          ]
        : [],
      primary: fallback
        ? {
            id: -1,
            url: fallback,
            alt: null,
            sort_order: 0,
            is_primary: true,
          }
        : null,
      fallbackUrl: fallback,
    };
  }

  // Si tenemos imágenes propias pero ninguna era primary, marcamos la
  // primera del array como primary para que `primary` siempre tenga valor
  // cuando hay galería. (La primary real en DB es la que ordena primero.)
  const resolvedPrimary =
    list.find((i) => i.is_primary) ?? list[0];

  // Reordenamos: la primary primero, el resto por sort_order asc.
  const ordered = [
    resolvedPrimary,
    ...list.filter((i) => i.id !== resolvedPrimary.id),
  ];

  return {
    ordered,
    primary: resolvedPrimary,
    fallbackUrl: fallback,
  };
}
