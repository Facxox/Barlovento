import 'server-only';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  computeBreakdown,
  recordRedemption,
  type CartItem,
  type Customer,
} from '@/lib/coupons';

export type RawItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  currency: string;
};

export type OrderRow = {
  id: number;
  items: RawItem[];
  total: number | string;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_type: 'retail' | 'wholesale' | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled';
};

export type MpStatus = 'paid' | 'pending' | 'cancelled' | 'fulfilled';

export function mapMpStatus(mpStatus: string | undefined): MpStatus {
  switch (mpStatus) {
    case 'approved':
      return 'paid';
    case 'rejected':
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      return 'cancelled';
    default:
      return 'pending';
  }
}

async function findOrderByPreferenceId(
  supabase: ReturnType<typeof getServiceSupabase>,
  preferenceId: string
): Promise<OrderRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('mp_preference_id', preferenceId)
    .maybeSingle();
  if (error) {
    console.error('mp-webhook: findOrderByPreferenceId error', error.message);
    return null;
  }
  return (data as OrderRow | null) ?? null;
}

async function findOrderById(
  supabase: ReturnType<typeof getServiceSupabase>,
  orderId: number
): Promise<OrderRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) {
    console.error('mp-webhook: findOrderById error', error.message);
    return null;
  }
  return (data as OrderRow | null) ?? null;
}

/**
 * Redime el cupón asociado a una orden pagada. Idempotente.
 */
export async function redeemCouponIfAny(
  supabase: ReturnType<typeof getServiceSupabase>,
  order: OrderRow
): Promise<void> {
  if (!supabase) return;

  const couponItem = (order.items ?? []).find(
    (it) => typeof it.id === 'string' && it.id.startsWith('coupon:')
  );
  if (!couponItem) return;

  const couponId = couponItem.id.replace(/^coupon:/, '');

  // Idempotencia: no re-redimir si ya hay fila aplicada.
  const { data: existing } = await supabase
    .from('coupon_redemptions')
    .select('id')
    .eq('order_id', order.id)
    .eq('status', 'applied')
    .maybeSingle();
  if (existing) return;

  const { data: couponRow } = await supabase
    .from('coupons')
    .select('*, rules:coupon_rules(*)')
    .eq('id', couponId)
    .maybeSingle();
  if (!couponRow) {
    console.warn('mp-webhook: coupon not found for order', order.id, couponId);
    return;
  }

  const cartForBreakdown: CartItem[] = (order.items ?? [])
    .filter((it) => !(typeof it.id === 'string' && it.id.startsWith('coupon:')))
    .map((it) => ({
      id: it.id,
      name: it.name,
      category: '',
      qty: it.qty,
      price: it.price,
      currency: it.currency,
    }));

  const breakdown = computeBreakdown(
    couponRow.rules as any,
    cartForBreakdown,
    0
  );

  const customer: Customer = {
    email: order.customer_email,
    customer_type: order.customer_type,
  };

  try {
    await recordRedemption(supabase as any, {
      coupon: couponRow as any,
      breakdown,
      customer,
      order_id: order.id,
      cart: cartForBreakdown,
    });
  } catch (e: any) {
    console.error('mp-webhook: recordRedemption failed', e?.message ?? e);
  }
}

export type ProcessArgs = {
  preferenceId: string;
  paymentId: string | null;
  paymentStatus: string | undefined;
};

/**
 * Aplica el resultado de un pago a la orden: actualiza status + mp_payment_id
 * (sólo avanza desde `pending`) y redime el cupón si quedó pagada.
 *
 * Retorna la status final aplicada, o null si no se encontró la orden.
 */
export async function processPaymentResult(
  args: ProcessArgs
): Promise<{ orderId: number; nextStatus: MpStatus } | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    console.error('mp-webhook: supabase service role missing');
    return null;
  }

  const order = await findOrderByPreferenceId(supabase, args.preferenceId);
  if (!order) {
    console.warn('mp-webhook: order not found for preference', args.preferenceId);
    return null;
  }

  const nextStatus = mapMpStatus(args.paymentStatus);

  if (nextStatus !== order.status) {
    const { error } = await supabase
      .from('orders')
      .update({
        status: nextStatus,
        mp_payment_id: args.paymentId ?? order.mp_payment_id,
      })
      .eq('id', order.id)
      .in('status', ['pending']);
    if (error) {
      console.error('mp-webhook: order update failed', error.message);
      return null;
    }
  }

  if (nextStatus === 'paid') {
    await redeemCouponIfAny(supabase, order);
  }

  return { orderId: order.id, nextStatus };
}

/**
 * Versión admin: busca por order_id. Permite cualquier transición
 * (incluyendo reversiones paid → cancelled). Usado por mark-paid
 * y simulate-payment, ambos protegidos por requireAdminStrict.
 */
export async function processOrderById(
  orderId: number,
  nextStatus: MpStatus,
  paymentId: string | null
): Promise<{ orderId: number; nextStatus: MpStatus } | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const order = await findOrderById(supabase, orderId);
  if (!order) return null;

  if (nextStatus !== order.status) {
    const { error } = await supabase
      .from('orders')
      .update({
        status: nextStatus,
        mp_payment_id: paymentId ?? order.mp_payment_id,
      })
      .eq('id', order.id);
    if (error) {
      console.error('mp-webhook: processOrderById failed', error.message);
      return null;
    }
  }

  if (nextStatus === 'paid') {
    await redeemCouponIfAny(supabase, order);
  }

  return { orderId: order.id, nextStatus };
}