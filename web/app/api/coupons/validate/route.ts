import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  fetchCouponByCode,
  countUserRedemptions,
  evaluateCoupon,
  type CartItem,
  type Customer,
} from '@/lib/coupons';

type Body = {
  code: string;
  cart: CartItem[];
  customer?: Customer;
  shipping_cost?: number;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body.code || !Array.isArray(body.cart) || body.cart.length === 0) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }

  const coupon = await fetchCouponByCode(supabase, body.code);
  if (!coupon) {
    return NextResponse.json({
      ok: false,
      code: 'not_found',
      message: 'Cupón no encontrado.',
    }, { status: 404 });
  }

  const customer: Customer = body.customer ?? {};
  const user_redemption_count = await countUserRedemptions(supabase, coupon.id, customer);

  const result = evaluateCoupon({
    coupon,
    cart: body.cart,
    customer,
    user_redemption_count,
    shipping_cost: body.shipping_cost ?? 0,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 200 }); // 200 con ok:false (es un rechazo de negocio, no error HTTP)
  }

  return NextResponse.json({
    ok: true,
    code: coupon.code,
    coupon_id: coupon.id,
    discount_total: result.breakdown.discount_total,
    shipping_discount: result.breakdown.shipping_discount,
    lines: result.breakdown.lines,
  });
}
