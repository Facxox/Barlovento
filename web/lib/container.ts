// Tipos y helpers para productos contenedores (0019_container_products.sql).
//
// Modelo (lo define la migración, este archivo sólo lo tipa):
//
//   products (+) is_container, container_base_price, price_mode,
//              container_capacity, container_min_units,
//              container_max_units, container_require_full,
//              can_be_in_container
//
//   product_container_items  →  (container_product_id, child_product_id,
//                                 min_qty, max_qty, sort_order)
//
// price_mode:
//   'replace'           → el precio final = container_base_price
//   'base_plus_content' → precio final = base + Σ contenidos
//   'content_only'      → precio final = Σ contenidos (base ignorado)

export type PriceMode = 'replace' | 'base_plus_content' | 'content_only';

export type ContainerConfig = {
  is_container: boolean;
  /** Precio base independiente del contenido. Null = usar products.price. */
  container_base_price: number | null;
  price_mode: PriceMode;
  /** Capacidad (cupos físicos). Null = sin tope (rara vez). */
  container_capacity: number | null;
  container_min_units: number;
  container_max_units: number | null;
  container_require_full: boolean;
};

export type ChildProductRef = {
  product_id: string;
  min_qty: number;
  max_qty: number | null;
  sort_order: number;
};

export type ContainerChild = {
  product: ProductRef;
  min_qty: number;
  max_qty: number | null;
  sort_order: number;
};

export type ProductRef = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string | null;
  is_active: boolean;
};

export type CompositionLine = {
  child_product_id: string;
  /** Cuántas unidades del child entran en ESTE pack. */
  qty: number;
};

export type ContainerValidation = {
  ok: boolean;
  errors: string[];
};

export type ContainerPricing = {
  base: number;
  contents: number;
  total: number;
  currency: string;
  breakdown: { label: string; amount: number }[];
};

/** Capacidad efectiva del contenedor respetando max (que siempre debe
 *  ser <= capacity). Si max_units está seteado en el contenedor, ése
 *  manda; si no, capacity; fallback 1. */
export function effectiveCapacity(c: ContainerConfig): number {
  if (c.container_capacity && c.container_capacity > 0) {
    if (c.container_max_units && c.container_max_units > 0) {
      return Math.min(c.container_capacity, c.container_max_units);
    }
    return c.container_capacity;
  }
  if (c.container_max_units && c.container_max_units > 0) {
    return c.container_max_units;
  }
  return 1;
}

/** Mínimo de unidades que el cliente DEBE seleccionar (configurable,
 *  pero siempre >= 1). */
export function effectiveMinUnits(c: ContainerConfig): number {
  if (c.container_min_units > 0) return c.container_min_units;
  return 1;
}

/**
 * Valida una composición candidata contra la config del contenedor.
 *
 * Reglas aplicadas (todas son server-side; el cliente también las
 * chequea, pero acá vive la fuente de verdad):
 *
 *  - Total de unidades entre min y max efectivos
 *  - Si require_full, debe alcanzar la capacidad
 *  - Cada child respeta su min_qty / max_qty propios
 *  - Hijos no permitidos (min_qty=0 y qty=0) se ignoran; cualquier otro
 *    qty>0 debe estar habilitado (esto lo garantizamos también a nivel
 *    de selección UI, pero lo defendemos acá para cubrir tampering).
 */
export function validateComposition(
  config: ContainerConfig,
  children: ContainerChild[],
  composition: CompositionLine[]
): ContainerValidation {
  const errors: string[] = [];
  const cap = effectiveCapacity(config);
  const minU = effectiveMinUnits(config);
  const maxU = config.container_max_units ?? cap;

  const totalUnits = composition.reduce((acc, l) => acc + l.qty, 0);

  if (totalUnits < minU) {
    errors.push(`Seleccioná al menos ${minU} unidad${minU === 1 ? '' : 'es'}.`);
  }
  if (totalUnits > maxU) {
    errors.push(`El contenedor admite hasta ${maxU} unidades.`);
  }
  if (config.container_require_full && totalUnits < cap) {
    errors.push(`Para completar el contenedor elegí ${cap} unidades.`);
  }

  // Validar cada hijo
  for (const line of composition) {
    const child = children.find((c) => c.product.id === line.child_product_id);
    if (!child) {
      errors.push(`El producto ${line.child_product_id} no está habilitado para este contenedor.`);
      continue;
    }
    if (line.qty < 0) {
      errors.push('Cantidad inválida.');
      continue;
    }
    if (child.min_qty > 0 && line.qty < child.min_qty) {
      errors.push(
        `${child.product.name}: el mínimo por unidad es ${child.min_qty}.`
      );
    }
    if (child.max_qty != null && line.qty > child.max_qty) {
      errors.push(
        `${child.product.name}: el máximo por unidad es ${child.max_qty}.`
      );
    }
  }

  // Si hay lineas y alguno está disabled (inactivo), es error.
  for (const line of composition) {
    const child = children.find((c) => c.product.id === line.child_product_id);
    if (child && !child.product.is_active) {
      errors.push(
        `${child.product.name} ya no está disponible. Quitá la selección.`
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Calcula el precio final del contenedor para una composición
 * específica. Aplica `price_mode`:
 *
 *  - replace           → base (ignora contenidos)
 *  - base_plus_content → base + Σ (qty × child.price)
 *  - content_only      → Σ (qty × child.price)
 *
 * Si no hay líneas de contenido, el precio es siempre `base` (o el
 * products.price si container_base_price es null).
 */
export function computeContainerPrice(
  config: ContainerConfig,
  productsBasePrice: number,
  children: ContainerChild[],
  composition: CompositionLine[],
  currency: string
): ContainerPricing {
  const base = config.container_base_price ?? productsBasePrice;
  const contents = composition.reduce((acc, l) => {
    const child = children.find((c) => c.product.id === l.child_product_id);
    if (!child) return acc;
    return acc + l.qty * child.product.price;
  }, 0);

  let total: number;
  switch (config.price_mode) {
    case 'replace':
      total = base;
      break;
    case 'content_only':
      total = contents;
      break;
    case 'base_plus_content':
    default:
      total = base + contents;
  }

  const breakdown: { label: string; amount: number }[] = [];
  if (config.price_mode !== 'content_only' && base !== 0) {
    breakdown.push({ label: 'Base', amount: base });
  }
  for (const l of composition) {
    const child = children.find((c) => c.product.id === l.child_product_id);
    if (!child || l.qty === 0) continue;
    breakdown.push({
      label: `${l.qty} × ${child.product.name}`,
      amount: l.qty * child.product.price,
    });
  }

  return { base, contents, total, currency, breakdown };
}
