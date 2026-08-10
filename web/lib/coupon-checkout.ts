import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  countUserRedemptions,
  evaluateCoupon,
  type CartItem,
  type Customer,
} from '@/lib/coupons';

/**
 * Revalida un cupón contra el carrito autoritativo en el momento del
 * checkout. Devuelve el descuento total que se debe aplicar al subtotal.
 *
 * A diferencia de /api/coupons/validate, este helper:
 *   - NO confía en precios/qtys/categorías provistos por el cliente
 *     (deben venir del servidor, ya resueltos).
 *   - Devuelve un código de error en vez de un mensaje para que el
 *     caller mapee a la respuesta HTTP adecuada.
 */

export type CheckoutCouponOk = {
  ok: true;
  code: string;
  coupon_id: string;
  discount_total: number;
  currency: string;
};

export type CheckoutCouponErr = {
  ok: false;
  code:
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
    | 'not_combinable'
    | 'already_applied';
};

export type CheckoutCouponResult = CheckoutCouponOk | CheckoutCouponErr;

export async function validateCouponForCheckout(args: {
  supabase: SupabaseClient;
  code: string;
  cart: CartItem[];
  customerEmail?: string | null;
  userId?: string | null;
}): Promise<CheckoutCouponResult> {
  const { supabase, code, cart, customerEmail, userId } = args;

  const { data: couponRow, error: couponErr } = await supabase
    .from('coupons')
    .select('*, rules:coupon_rules(*)')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();

  if (couponErr || !couponRow) {
    return { ok: false, code: 'not_found' };
  }

  // El cliente (CheckoutForm) no conoce customer_type — siempre manda
  // null. Para mayoristas, el checkout ya está bloqueado en
  // /api/checkout. Si en el futuro mayoristas pueden comprar con MP,
  // acá se debe pasar customer_type desde el perfil.
  const customer: Customer = {
    user_id: userId ?? null,
    email: customerEmail ?? null,
  };

  let userRedemptionCount = 0;
  try {
    userRedemptionCount = await countUserRedemptions(
      supabase,
      (couponRow as { id: string }).id,
      customer
    );
  } catch {
    // Si la tabla de redenciones no existe o falla, dejamos seguir y
    // la verificación dura la hace recordRedemption vía RPC.
    userRedemptionCount = 0;
  }

  const result = evaluateCoupon({
    coupon: couponRow as any,
    cart,
    customer,
    user_redemption_count: userRedemptionCount,
    shipping_cost: 0,
  });

  if (!result.ok) {
    return { ok: false, code: result.code };
  }

  const currency = cart[0]?.currency ?? 'UYU';
  return {
    ok: true,
    code: (couponRow as { code: string }).code,
    coupon_id: (couponRow as { id: string }).id,
    discount_total: Math.max(0, result.breakdown.discount_total),
    currency,
  };
}