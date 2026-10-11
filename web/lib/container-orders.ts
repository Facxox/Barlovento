// Helper para validar/persistir pedidos que contengan productos
// contenedores. Se consume desde /api/checkout, /api/orders/whatsapp y
// el admin (en admin-actions.ts).
//
// La validación es siempre server-side: el cliente puede tener
// cualquier configuración en localStorage; esta función reconstruye la
// verdad contra la DB (container_config + container_items + catálogos)
// y devuelve el precio/estructura correctos.
//
// Contrato:
//
//   validateContainerOrder(items) → { ok, validated, totals }
//     items: ClientItem[] del cliente (estructura del carrito)
//     validated: ClientItem[] con nombre/precio/quantity ya saneados
//     totals: { subtotal, shippingCost, total }
//
// La función NO descuenta stock ni crea la orden. Eso lo hace el caller.

import 'server-only';
import { getServiceSupabase } from './supabase-admin';
import {
  validateComposition,
  computeContainerPrice,
  effectiveCapacity,
  type ContainerChild,
  type CompositionLine,
} from './container';

export type ClientItem = {
  id: string;
  name?: string;
  qty: number;
  price?: number;
  currency?: string;
  /** Si el item es un contenedor, el array de composiciones. */
  composition?: CompositionLine[];
};

export type ValidatedItem = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  currency: string;
  units_per_pack: number;
  kind?: 'container';
  parentLineId?: string;
  composition?: Array<{
    child_product_id: string;
    child_name: string;
    qty: number;
    unit_price: number;
    currency: string;
    child_image: string | null;
  }>;
};

export type ValidateResult = {
  ok: boolean;
  validated: ValidatedItem[];
  totals: {
    subtotal: number;
    shippingCost: number;
    total: number;
    alfajores: number;
  };
  errors: string[];
  /** Filas para insertar en order_container_items si la orden se crea. */
  persistableCompositions: Array<{
    container_item_id: string;
    container_product_id: string;
    child_product_id: string;
    child_name: string;
    child_price: number;
    child_image: string | null;
    qty: number;
  }>;
};

const MAX_QTY = 99;
const SHIPPING_LE_20 = 195;
const SHIPPING_MAS_20 = 220;
const SHIPPING_THRESHOLD = 20;

function calcShippingCost(alfajores: number): number {
  if (alfajores <= 0) return 0;
  return alfajores > SHIPPING_THRESHOLD ? SHIPPING_MAS_20 : SHIPPING_LE_20;
}

export async function validateContainerOrder(
  items: ClientItem[]
): Promise<ValidateResult> {
  const errors: string[] = [];
  const out: ValidateResult = {
    ok: true,
    validated: [],
    totals: { subtotal: 0, shippingCost: 0, total: 0, alfajores: 0 },
    errors,
    persistableCompositions: [],
  };

  if (!Array.isArray(items) || items.length === 0) {
    out.ok = false;
    errors.push('empty_cart');
    return out;
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    out.ok = false;
    errors.push('db_unavailable');
    return out;
  }

  // 1) Cargar todos los productos referenciados en una sola pasada.
  //    También miramos wholesale_products para tolerar pedidos de
  //    ambos canales.
  const ids = Array.from(new Set(items.map((i) => i.id).filter(Boolean)));
  const [retailRes, wholesaleRes] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, name, price, currency, is_active, units_per_pack, is_container, container_base_price, price_mode, container_capacity, container_min_units, container_max_units, container_require_full, can_be_in_container'
      )
      .in('id', ids),
    supabase
      .from('wholesale_products')
      .select('id, name, price, currency, is_active, units_per_pack')
      .in('id', ids),
  ]);

  type ProductRow = {
    id: string;
    name: string;
    price: number;
    currency: string;
    is_active: boolean;
    units_per_pack: number | null;
    is_container?: boolean;
    container_base_price?: number | null;
    price_mode?: string | null;
    container_capacity?: number | null;
    container_min_units?: number | null;
    container_max_units?: number | null;
    container_require_full?: boolean | null;
    can_be_in_container?: boolean | null;
  };

  const catalog = new Map<string, ProductRow>();
  for (const r of (wholesaleRes.data ?? []) as ProductRow[]) {
    catalog.set(r.id, r);
  }
  for (const r of (retailRes.data ?? []) as ProductRow[]) {
    catalog.set(r.id, r); // retail pisa a wholesale si está duplicado
  }

  let currency: string | null = null;
  let subtotal = 0;
  let totalAlfajores = 0;

  // 2) Por cada item: validar contra la DB.
  for (const it of items) {
    if (!it || typeof it !== 'object') {
      errors.push('invalid_item');
      continue;
    }
    if (it.id?.startsWith('coupon:') || it.id === 'shipping' || it.id === 'pickup') {
      // líneas informativas: validar al final aparte
      continue;
    }
    const row = catalog.get(it.id);
    if (!row) {
      errors.push(`product_not_found:${it.id}`);
      continue;
    }
    if (!row.is_active) {
      errors.push(`product_inactive:${it.id}`);
      continue;
    }
    if (typeof it.qty !== 'number' || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > MAX_QTY) {
      errors.push(`invalid_qty:${it.id}`);
      continue;
    }
    if (currency && row.currency !== currency) {
      errors.push('mixed_currencies');
      continue;
    }
    currency = row.currency;
    const unitPrice = Number(row.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push(`invalid_catalog_price:${it.id}`);
      continue;
    }
    const upp = row.units_per_pack && row.units_per_pack > 0 ? row.units_per_pack : 1;

    // Si es contenedor, el price del cliente es reemplazado por el
    // precio calculado server-side.
    if (row.is_container && Array.isArray(it.composition) && it.composition.length > 0) {
      // Traer hijos permitidos para este contenedor.
      const { data: itemRows, error: itemErr } = await supabase
        .from('product_container_items')
        .select(
          'child_product_id, min_qty, max_qty, sort_order, child:products!product_container_items_child_product_id_fkey(id, name, price, currency, image, is_active, can_be_in_container)'
        )
        .eq('container_product_id', it.id)
        .order('sort_order', { ascending: true });
      if (itemErr) {
        errors.push(`container_lookup_failed:${it.id}`);
        continue;
      }
      const children: ContainerChild[] = [];
      type ChildProductRow = {
        id: string;
        name: string;
        price: number;
        currency: string;
        image: string | null;
        is_active: boolean;
        can_be_in_container: boolean;
      };
      type ItemRow = {
        child_product_id: string;
        min_qty: number;
        max_qty: number | null;
        sort_order: number;
        child: ChildProductRow | ChildProductRow[] | null;
      };
      for (const r of (itemRows ?? []) as ItemRow[]) {
        const child = Array.isArray(r.child) ? r.child[0] : r.child;
        if (!child) continue;
        if (!child.is_active || !child.can_be_in_container) continue;
        children.push({
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

      const config = {
        is_container: true,
        container_base_price: row.container_base_price ?? null,
        price_mode: (row.price_mode as 'replace' | 'base_plus_content' | 'content_only' | null) ?? 'base_plus_content',
        container_capacity: row.container_capacity ?? null,
        container_min_units: row.container_min_units ?? 1,
        container_max_units: row.container_max_units ?? null,
        container_require_full: !!row.container_require_full,
      };

      const compValidation = validateComposition(config, children, it.composition);
      if (!compValidation.ok) {
        for (const e of compValidation.errors) errors.push(`composition:${it.id}:${e}`);
        continue;
      }

      const pricing = computeContainerPrice(
        config,
        unitPrice,
        children,
        it.composition,
        row.currency
      );

      const parentLineId = `cont-${it.id}-${stableHash(it.composition)}`;

      // Para contenedores, las unidades físicas (Σ child.qty) son las que
      // pesan en el envío.
      const childUnits = it.composition.reduce((a, l) => a + l.qty, 0);
      totalAlfajores += childUnits;

      subtotal += pricing.total;

      out.validated.push({
        id: it.id,
        name: row.name,
        qty: it.qty,
        unit_price: pricing.total,
        currency: row.currency,
        units_per_pack: childUnits,
        kind: 'container',
        parentLineId,
        composition: it.composition.map((l) => {
          const child = children.find((c) => c.product.id === l.child_product_id);
          return {
            child_product_id: l.child_product_id,
            child_name: child?.product.name ?? l.child_product_id,
            qty: l.qty,
            unit_price: child?.product.price ?? 0,
            currency: child?.product.currency ?? row.currency,
            child_image: child?.product.image ?? null,
          };
        }),
      });

      // Filas para persistir en order_container_items, una por (child,
      // qty) por cada unidad del contenedor. Multiplicamos por la qty
      // del contenedor para reflejar exactamente el pedido.
      for (let i = 0; i < it.qty; i++) {
        for (const l of it.composition) {
          const child = children.find((c) => c.product.id === l.child_product_id);
          out.persistableCompositions.push({
            container_item_id: parentLineId,
            container_product_id: it.id,
            child_product_id: l.child_product_id,
            child_name: child?.product.name ?? l.child_product_id,
            child_price: child?.product.price ?? 0,
            child_image: child?.product.image ?? null,
            qty: l.qty,
          });
        }
      }
    } else {
      // Producto normal
      subtotal += unitPrice * it.qty;
      totalAlfajores += upp * it.qty;
      out.validated.push({
        id: it.id,
        name: row.name,
        qty: it.qty,
        unit_price: unitPrice,
        currency: row.currency,
        units_per_pack: upp,
      });
    }
  }

  out.totals.subtotal = subtotal;
  out.totals.alfajores = totalAlfajores;
  out.totals.shippingCost = calcShippingCost(totalAlfajores);
  out.totals.total = subtotal + out.totals.shippingCost;
  out.ok = errors.length === 0;

  return out;
}

/** Persiste las composiciones de un pedido ya creado. Llamar DESPUÉS
 *  del INSERT en orders. Service-role required. */
export async function persistOrderCompositions(
  orderId: number,
  rows: ValidateResult['persistableCompositions']
): Promise<{ ok: boolean; error?: string }> {
  if (rows.length === 0) return { ok: true };
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'db_unavailable' };
  const payload = rows.map((r) => ({ ...r, order_id: orderId }));
  const { error } = await supabase.from('order_container_items').insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Hash determinístico del array de composición, idéntico al que usa
 *  el cliente en el carrito para los parentLineId. */
function stableHash(composition: CompositionLine[]): string {
  const k = composition
    .slice()
    .sort((a, b) => a.child_product_id.localeCompare(b.child_product_id))
    .map((l) => `${l.child_product_id}x${l.qty}`)
    .join('|');
  let h = 5381;
  for (let i = 0; i < k.length; i++) h = (h * 33) ^ k.charCodeAt(i);
  return (h >>> 0).toString(36);
}

void effectiveCapacity;
