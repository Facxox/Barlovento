// Helpers de presentación para productos contenedores.
//
// Mantiene un solo lugar para formatear el desglose (líneas de
// "2 × Alfajor Marroc") y para mensajes WhatsApp. NO toca el server.
//
// Tipos:
//
//   BreakdownLine            → línea simple ya formada (qty + nombre + precio)
//   OrderContainerSnapshot   → filas persistidas en order_container_items
//                               (lo que devuelve /api/orders/[id])
//   ContainerCompositionItem → snapshot de un hijo dentro de un item del
//                               carrito actual (cartItem.composition[])
//
// Funciones exportadas:
//
//   formatBreakdownLine      → "2 × Alfajor Marroc"
//   formatBreakdownLineWithPrice → "2 × Alfajor Marroc  ·  $UY 240"
//   summarizeComposition     → líneas para UI (qty × nombre, amount)
//   buildWhatsAppComposition → bloque multiline para mensajes WhatsApp
//   describeCompositionTotal → "X unidades seleccionadas"
//   isComplete               → completó la capacidad efectiva
//
// Usos:
//   - ContainerCompositionList: feedback en el modal/configurador
//   - CartDrawer, CheckoutForm, mi-cuenta, admin pedidos: desglose
//   - api/orders/whatsapp, whatsapp-cart-link: cuerpo del mensaje

import type { CompositionLine } from './container';

/** Línea de composición con metadata ya enriquecida (la del CartItem).
 *  Re-declarada acá para no importar CartContext (client-only) desde
 *  módulos server-only. */
export type CartItemCompositionLine = {
  child_product_id: string;
  child_name: string;
  qty: number;
  unit_price: number;
  currency: string;
  child_image: string | null;
};

export type OrderContainerSnapshot = {
  order_id: number;
  container_item_id: string;
  container_product_id: string;
  child_product_id: string;
  child_name: string;
  child_price: number;
  child_image: string | null;
  qty: number;
};

export type BreakdownLine = {
  /** qty en el contenedor; ≥ 1. */
  qty: number;
  /** Nombre del producto hijo (snapshot, no se renombra). */
  name: string;
  /** qty × child_price, redondeado a 2 decimales. */
  amount: number;
  /** Imagen del hijo (cuando exista; null si no). */
  image: string | null;
  /** Id del producto hijo — útil para keys. */
  child_product_id: string;
  /** Moneda. */
  currency: string;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Formato display simple: "2 × Alfajor Marroc". */
export function formatBreakdownLine(qty: number, name: string): string {
  if (!qty || qty <= 0) return name;
  return `${qty} × ${name}`;
}

/** Línea con precio inline: "2 × Alfajor Marroc · $UY 240".
 *  Útil para listas densas (desglose del carrito). */
export function formatBreakdownLineWithPrice(
  qty: number,
  name: string,
  amount: number,
  currency: string
): string {
  if (!qty || qty <= 0) return name;
  const num = new Intl.NumberFormat('es-UY', {
    maximumFractionDigits: 0,
  }).format(round2(amount));
  // No importamos formatMoney acá para mantener este helper libre de
  // dependencias y reusable también en server.
  return `${qty} × ${name} · ${currency} ${num}`;
}

/** Convierte composition[] (line shape) en líneas display completas.
 *  Acepta ambas shapes: CompositionLine (compacta) o
 *  CartItemCompositionLine (con amount/image ya calculados). */
export function summarizeComposition(
  composition: ReadonlyArray<
    | CompositionLine
    | (CartItemCompositionLine & { child_image?: string | null })
  >,
  currency: string
): BreakdownLine[] {
  return composition
    .filter((l) => l.qty > 0)
    .map((l) => {
      const unitPrice = (l as CartItemCompositionLine).unit_price ?? 0;
      const qty = l.qty;
      const amount = round2(unitPrice * qty);
      const name = (l as CartItemCompositionLine).child_name ?? l.child_product_id;
      const image =
        ((l as CartItemCompositionLine).child_image as string | null | undefined) ??
        null;
      return {
        qty,
        name,
        amount,
        image,
        child_product_id: l.child_product_id,
        currency,
      };
    });
}

/** Bloque multiline listo para mensajes WhatsApp / admin.
 *  Devuelve un string con cada ítem en una línea:
 *    "  • 2 × Alfajor Marroc ($UY 240)
 *      • 1 × Alfajor Clásico ($UY 120)" */
export function buildWhatsAppComposition(
  lines: ReadonlyArray<BreakdownLine>
): string {
  if (lines.length === 0) return '';
  const num = (n: number) =>
    new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(round2(n));
  return lines
    .map(
      (l) =>
        `  • ${l.qty} × ${l.name}${
          l.amount > 0 ? ` (${l.currency} ${num(l.amount)})` : ''
        }`
    )
    .join('\n');
}

/** Suma total de unidades dentro del contenedor. */
export function totalUnits(
  composition: ReadonlyArray<{ qty: number }>
): number {
  return composition.reduce((acc, l) => acc + (l.qty ?? 0), 0);
}

/** ¿La composición ya alcanzó la capacidad efectiva? */
export function isComplete(
  composition: ReadonlyArray<{ qty: number }>,
  effectiveCapacity: number
): boolean {
  const total = totalUnits(composition);
  return total >= effectiveCapacity && effectiveCapacity > 0;
}

/** Texto de progreso listo para UI:
 *   - Con capacidad: "2 de 6 · te faltan 4 unidades"
 *   - Sin capacidad (no debería pasar): "2 unidades" */
export function describeProgress(
  composition: ReadonlyArray<{ qty: number }>,
  effectiveCapacity: number | null | undefined
): string {
  const total = totalUnits(composition);
  if (!effectiveCapacity || effectiveCapacity <= 0) {
    return `${total} unidad${total === 1 ? '' : 'es'}`;
  }
  if (total >= effectiveCapacity) {
    return `${total} de ${effectiveCapacity} · ¡completa!`;
  }
  const missing = effectiveCapacity - total;
  return `${total} de ${effectiveCapacity} · te falta${missing === 1 ? '' : 'n'} ${missing} unidad${missing === 1 ? '' : 'es'}`;
}

/** Agrupa las filas de order_container_items por container_item_id.
 *  Cada group tiene la info del contenedor padre (product_id, item_id) y
 *  las líneas de los hijos. Es el formato para mostrar el desglose en
 *  un pedido guardado. */
export type OrderContainerGroup = {
  container_item_id: string;
  container_product_id: string;
  lines: BreakdownLine[];
};

export function groupOrderContainerItems(
  rows: ReadonlyArray<OrderContainerSnapshot>
): OrderContainerGroup[] {
  const byGroup = new Map<string, OrderContainerGroup>();
  for (const r of rows) {
    let g = byGroup.get(r.container_item_id);
    if (!g) {
      g = {
        container_item_id: r.container_item_id,
        container_product_id: r.container_product_id,
        lines: [],
      };
      byGroup.set(r.container_item_id, g);
    }
    g.lines.push({
      qty: r.qty,
      name: r.child_name,
      amount: round2(r.child_price * r.qty),
      image: r.child_image ?? null,
      child_product_id: r.child_product_id,
      currency: '', // el caller sabe la moneda del item padre
    });
  }
  return Array.from(byGroup.values());
}
