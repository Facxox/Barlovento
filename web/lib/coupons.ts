/**
 * Motor de validación y cálculo de descuentos para cupones.
 *
 * Diseño:
 *  - Un cupón tiene 1..N "rules". Cada rule es un beneficio independiente.
 *  - Las rules se evalúan en orden; se acumulan descuentos.
 *  - El cupón en sí mismo es solo la "campaña" (vigencia, límites, combinabilidad).
 *
 * Uso típico:
 *   const result = await validateCoupon('VERANO20', cart, customer);
 *   if (result.ok) applyCoupon(result.coupon, cart);
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- Tipos ----------

export type CartItem = {
  id: string;
  name: string;
  category: string;
  qty: number;
  price: number;       // unit price
  currency: string;
};

export type Customer = {
  user_id?: string | null;
  email?: string | null;
  customer_type?: 'retail' | 'wholesale' | null;
};

export type CouponRule = {
  id: string;
  kind: 'percent' | 'fixed' | 'free_shipping' | 'bxgy' | 'gift_product';
  value: number | null;
  config: BxGyConfig | GiftConfig | Record<string, never>;
  applies_to: AppliesTo;
  sort_order: number;
};

export type BxGyConfig = {
  buy_qty: number;
  get_qty: number;
  get_discount_pct: number;   // 100 = totalmente gratis
};

export type GiftConfig = {
  gift_product_id: string;
  gift_qty?: number;
};

export type AppliesTo =
  | { all: true }
  | { product_ids: string[] }
  | { categories: string[] };

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  min_subtotal: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number | null;
  combinable: boolean;
  customer_type: 'retail' | 'wholesale' | null;
  rules: CouponRule[];
};

export type ValidationOk = {
  ok: true;
  coupon: Coupon;
  breakdown: DiscountBreakdown;
  // total final = subtotal + shipping - discount
  // (free_shipping = shipping_cost restado)
};

export type ValidationErr = {
  ok: false;
  code: CouponErrorCode;
  message: string;
};

export type ValidationResult = ValidationOk | ValidationErr;

export type CouponErrorCode =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'min_subtotal'
  | 'usage_limit_reached'
  | 'per_user_limit_reached'
  | 'customer_type_mismatch'
  | 'not_applicable'
  | 'empty_cart'
  | 'already_applied'
  | 'not_combinable';

export type DiscountLine = {
  rule_id: string;
  kind: CouponRule['kind'];
  description: string;
  amount: number;
  affected_items: string[];     // product ids
  free_shipping: boolean;
};

export type DiscountBreakdown = {
  lines: DiscountLine[];
  discount_total: number;
  shipping_discount: number;    // monto restado al envío
  affected_subtotal: number;    // subtotal sobre el que se aplicó descuento
};

export type AppliedCoupon = {
  coupon_id: string;
  code: string;
  discount_total: number;
  shipping_discount: number;
};

// ---------- Helpers ----------

export function itemMatchesAppliesTo(item: CartItem, applies: AppliesTo): boolean {
  if ('all' in applies) return true;
  if ('product_ids' in applies) return applies.product_ids.includes(item.id);
  if ('categories' in applies) return applies.categories.includes(item.category);
  return false;
}

export function filterApplicableItems(cart: CartItem[], applies: AppliesTo): CartItem[] {
  return cart.filter((it) => itemMatchesAppliesTo(it, applies));
}

export function cartSubtotal(cart: CartItem[]): number {
  return round2(cart.reduce((acc, it) => acc + it.qty * it.price, 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- Validación de elegibilidad del cupón ----------

export type ValidationContext = {
  coupon: Coupon;
  cart: CartItem[];
  customer: Customer;
  user_redemption_count: number;   // cuántas veces este user ya canjeó este cupón
  shipping_cost?: number;          // opcional, default 0
  already_applied_codes?: string[];// códigos ya aplicados al carrito
};

export function evaluateCoupon(ctx: ValidationContext): ValidationResult {
  const { coupon, cart, customer, user_redemption_count, shipping_cost = 0 } = ctx;

  if (!coupon.is_active) {
    return reject('inactive', 'Este cupón ya no está disponible.');
  }
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return reject('not_started', 'Este cupón todavía no está vigente.');
  }
  if (coupon.ends_at && new Date(coupon.ends_at) < now) {
    return reject('expired', 'Este cupón ya venció.');
  }

  const subtotal = cartSubtotal(cart);
  if (coupon.min_subtotal !== null && subtotal < coupon.min_subtotal) {
    return reject(
      'min_subtotal',
      `Este cupón requiere un mínimo de ${coupon.min_subtotal}.`
    );
  }

  // usage_limit: la guarda atómica vive en la RPC `increment_coupon_usage`.
  // Aquí solo avisamos al usuario si ya está visiblemente agotado, pero la
  // fuente de verdad es la RPC al momento de canjear.
  if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
    return reject('usage_limit_reached', 'Este cupón alcanzó su límite de usos.');
  }

  if (
    coupon.per_user_limit !== null &&
    user_redemption_count >= coupon.per_user_limit
  ) {
    return reject('per_user_limit_reached', 'Ya usaste este cupón el máximo permitido.');
  }

  if (
    coupon.customer_type &&
    customer.customer_type &&
    coupon.customer_type !== customer.customer_type
  ) {
    return reject(
      'customer_type_mismatch',
      `Este cupón es solo para clientes ${coupon.customer_type === 'wholesale' ? 'mayoristas' : 'minoristas'}.`
    );
  }

  if (!coupon.combinable && (ctx.already_applied_codes?.length ?? 0) > 0) {
    return reject('not_combinable', 'Este cupón no se puede combinar con otros.');
  }

  if (cart.length === 0) {
    return reject('empty_cart', 'Tu carrito está vacío.');
  }

  // Calcular breakdown
  const breakdown = computeBreakdown(coupon.rules, cart, shipping_cost);

  // Si ninguna rule produjo efecto, el cupón "no aplica"
  const applicable = breakdown.lines.some(
    (l) => l.amount > 0 || l.free_shipping
  );
  if (!applicable) {
    return reject('not_applicable', 'Este cupón no aplica a los productos de tu carrito.');
  }

  // Aplicar tope máximo de descuento si está definido
  if (coupon.max_discount !== null && breakdown.discount_total > coupon.max_discount) {
    const factor = coupon.max_discount / breakdown.discount_total;
    breakdown.lines = breakdown.lines.map((l) => ({
      ...l,
      amount: round2(l.amount * factor),
    }));
    breakdown.discount_total = round2(coupon.max_discount);
  }

  return { ok: true, coupon, breakdown };
}

function reject(code: CouponErrorCode, message: string): ValidationErr {
  return { ok: false, code, message };
}

// ---------- Cálculo del descuento ----------

export function computeBreakdown(
  rules: CouponRule[],
  cart: CartItem[],
  shipping_cost: number
): DiscountBreakdown {
  const lines: DiscountLine[] = [];
  let discount_total = 0;
  let shipping_discount = 0;

  for (const rule of [...rules].sort((a, b) => a.sort_order - b.sort_order)) {
    const applicable = filterApplicableItems(cart, rule.applies_to);
    if (applicable.length === 0 && rule.kind !== 'free_shipping') continue;

    const affected_subtotal = round2(
      applicable.reduce((acc, it) => acc + it.qty * it.price, 0)
    );

    switch (rule.kind) {
      case 'percent': {
        const pct = (rule.value ?? 0) / 100;
        const amount = round2(affected_subtotal * pct);
        discount_total += amount;
        lines.push({
          rule_id: rule.id,
          kind: rule.kind,
          description: `${rule.value}% de descuento`,
          amount,
          affected_items: applicable.map((i) => i.id),
          free_shipping: false,
        });
        break;
      }

      case 'fixed': {
        const amount = Math.min(rule.value ?? 0, affected_subtotal);
        const rounded = round2(amount);
        discount_total += rounded;
        lines.push({
          rule_id: rule.id,
          kind: rule.kind,
          description: `${rule.value} de descuento`,
          amount: rounded,
          affected_items: applicable.map((i) => i.id),
          free_shipping: false,
        });
        break;
      }

      case 'free_shipping': {
        shipping_discount = round2(shipping_cost);
        lines.push({
          rule_id: rule.id,
          kind: rule.kind,
          description: 'Envío bonificado',
          amount: 0,
          affected_items: applicable.map((i) => i.id),
          free_shipping: true,
        });
        break;
      }

      case 'bxgy': {
        const cfg = rule.config as BxGyConfig;
        const line = computeBxGy(applicable, cfg);
        if (line.amount > 0) {
          discount_total += line.amount;
          lines.push(line);
        }
        break;
      }

      case 'gift_product': {
        const cfg = rule.config as GiftConfig;
        // El gift se modela como una línea con amount=0 (no descuenta plata)
        // pero el carrito del frontend debe sumar el product_id regalado.
        lines.push({
          rule_id: rule.id,
          kind: rule.kind,
          description: `Regalo: producto ${cfg.gift_product_id}`,
          amount: 0,
          affected_items: [cfg.gift_product_id],
          free_shipping: false,
        });
        break;
      }
    }
  }

  return {
    lines,
    discount_total: round2(discount_total),
    shipping_discount,
    affected_subtotal: 0, // informativo; el caller puede recalcular si quiere
  };
}

function computeBxGy(applicable: CartItem[], cfg: BxGyConfig): DiscountLine {
  // Agrupa por producto y cuenta unidades. Para cada grupo donde
  // qty >= buy_qty, descuenta get_qty unidades al get_discount_pct.
  const byProduct = new Map<string, CartItem>();
  for (const it of applicable) {
    const prev = byProduct.get(it.id);
    if (prev) prev.qty += it.qty;
    else byProduct.set(it.id, { ...it });
  }

  let totalDiscount = 0;
  const affected: string[] = [];

  for (const [id, it] of byProduct) {
    const sets = Math.floor(it.qty / (cfg.buy_qty + cfg.get_qty));
    if (sets > 0) {
      const freeUnits = sets * cfg.get_qty;
      const discountPerUnit = it.price * (cfg.get_discount_pct / 100);
      const amount = round2(freeUnits * discountPerUnit);
      totalDiscount += amount;
      affected.push(id);
    }
  }

  return {
    rule_id: '',
    kind: 'bxgy',
    description: `${cfg.buy_qty}x${cfg.buy_qty + cfg.get_qty}`,
    amount: round2(totalDiscount),
    affected_items: affected,
    free_shipping: false,
  };
}

// ---------- Capa de persistencia (Supabase) ----------

export async function fetchCouponByCode(
  supabase: SupabaseClient,
  code: string
): Promise<Coupon | null> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*, rules:coupon_rules(*)')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();

  if (error || !data) return null;
  return data as Coupon;
}

export async function countUserRedemptions(
  supabase: SupabaseClient,
  coupon_id: string,
  customer: Customer
): Promise<number> {
  let q = supabase
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', coupon_id)
    .eq('status', 'applied');

  if (customer.user_id) {
    q = q.eq('user_id', customer.user_id);
  } else if (customer.email) {
    q = q.eq('customer_email', customer.email);
  } else {
    return 0;
  }
  const { count } = await q;
  return count ?? 0;
}

export async function recordRedemption(
  supabase: SupabaseClient,
  args: {
    coupon: Coupon;
    breakdown: DiscountBreakdown;
    customer: Customer;
    order_id?: number | null;
    cart: CartItem[];
  }
): Promise<void> {
  const { coupon, breakdown, customer, order_id = null, cart } = args;

  for (const line of breakdown.lines) {
    if (line.amount === 0 && !line.free_shipping && line.kind !== 'gift_product') continue;

    await supabase.from('coupon_redemptions').insert({
      coupon_id: coupon.id,
      rule_id: line.rule_id || null,
      order_id,
      user_id: customer.user_id ?? null,
      customer_email: customer.email ?? null,
      customer_type: customer.customer_type ?? null,
      status: 'applied',
      discount_amount: line.amount,
      currency: cart[0]?.currency ?? 'UYU',
      cart_snapshot: { items: cart, line_description: line.description },
    });
  }

  // Increment atómico de usage_count con guarda de usage_limit.
  // Si la RPC lanza 'coupon_usage_limit_reached', lo dejamos propagar
  // para que el caller haga rollback de la orden.
  const { error: rpcErr } = await supabase.rpc('increment_coupon_usage', {
    p_coupon_id: coupon.id,
  });
  if (rpcErr) throw rpcErr;
}

export async function refundRedemption(
  supabase: SupabaseClient,
  order_id: number
): Promise<void> {
  await supabase
    .from('coupon_redemptions')
    .update({ status: 'refunded' })
    .eq('order_id', order_id)
    .eq('status', 'applied');
}
