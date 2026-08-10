import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { Payment } from 'mercadopago';
import { getMercadoPago } from '@/lib/mercadopago';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  computeBreakdown,
  fetchCouponByCode,
  recordRedemption,
  type CartItem,
  type Customer,
} from '@/lib/coupons';

/**
 * Webhook de notificaciones IPN/Webhooks v2 de MercadoPago.
 *
 * MP puede llamar este endpoint con dos "topics" distintos:
 *   - merchant_order   → orden de checkout (puede tener varios payments)
 *   - payment          → un pago puntual
 *
 * Como nuestro checkout usa Checkout Pro con `auto_return`, lo que nos
 * interesa es el estado del pago. Tomamos el `data.id` y consultamos
 * `Payment.findById` para tener la verdad oficial.
 *
 * IMPORTANTE: respondemos 200 rápido. Si tardamos >5s MP marca la
 * entrega como fallida y reintenta.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RawItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  currency: string;
};

type OrderRow = {
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

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

/**
 * Traduce el status de MP al status interno de `orders`.
 * Sólo marcamos `paid` cuando MP confirma aprobación.
 */
function mapMpStatus(mpStatus: string | undefined): 'paid' | 'pending' | 'cancelled' {
  switch (mpStatus) {
    case 'approved':
      return 'paid';
    case 'rejected':
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      // Para el MVP tratamos chargeback/refund como cancelado.
      return 'cancelled';
    default:
      return 'pending';
  }
}

/**
 * Buscamos la orden por preference_id. Si MP nos manda un payment
 * directo, igual podemos llegar al preference via `payment.preference_id`.
 */
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
    console.error('webhook: findOrderByPreferenceId error', error.message);
    return null;
  }
  return (data as OrderRow | null) ?? null;
}

/**
 * Si la orden ya tiene un cupón aplicado, lo redimimos ahora.
 * Idempotente: si ya hay una redención con este order_id, no hace nada.
 */
async function redeemCouponIfAny(
  supabase: ReturnType<typeof getServiceSupabase>,
  order: OrderRow
): Promise<void> {
  if (!supabase) return;

  // El cupón se manda como item con id `coupon:<id>` y precio negativo.
  const couponItem = (order.items ?? []).find(
    (it) => typeof it.id === 'string' && it.id.startsWith('coupon:')
  );
  if (!couponItem) return;

  const couponId = couponItem.id.replace(/^coupon:/, '');

  // Idempotencia: si ya redimimos esta orden, no repetir.
  const { data: existing } = await supabase
    .from('coupon_redemptions')
    .select('id')
    .eq('order_id', order.id)
    .eq('status', 'applied')
    .maybeSingle();
  if (existing) return;

  // Traemos el cupón para evaluar sus rules y armar el breakdown.
  const { data: couponRow } = await supabase
    .from('coupons')
    .select('*, rules:coupon_rules(*)')
    .eq('id', couponId)
    .maybeSingle();
  if (!couponRow) {
    console.warn('webhook: coupon not found for order', order.id, couponId);
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
    console.error('webhook: recordRedemption failed', e?.message ?? e);
  }
}

export async function POST(req: NextRequest) {
  // 1) Parsear el body. MP puede mandar application/x-www-form-urlencoded
  //    o application/json según la versión.
  const contentType = req.headers.get('content-type') ?? '';
  let payload: Record<string, unknown> = {};
  try {
    if (contentType.includes('application/json')) {
      payload = (await req.json()) as Record<string, unknown>;
    } else {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const type = String(payload.type ?? payload.topic ?? '');
  const dataIdRaw = payload.data?.id ?? payload.id;
  const dataId = dataIdRaw ? String(dataIdRaw) : null;

  // Sólo nos interesan notificaciones de pagos / merchant_orders.
  if (!type || !dataId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const mp = getMercadoPago();
  if (!mp) {
    console.error('webhook: MERCADO_PAGO_ACCESS_TOKEN missing');
    return NextResponse.json({ ok: false, error: 'mp_not_configured' }, { status: 503 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    console.error('webhook: supabase service role missing');
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }

  // 2) Si es un payment directo, consultamos MP por el payment.
  //    Si es merchant_order, consultamos por la merchant_order y de ahí
  //    sacamos el preference_id (que es lo que guardamos en la orden).
  let preferenceId: string | null = null;
  let paymentStatus: string | null = null;
  let paymentId: string | null = null;

  try {
    if (type === 'payment') {
      paymentId = dataId;
      const payment = await new Payment(mp).get({ id: dataId });
      // response puede ser response o body según versión; cubrimos ambas.
      const data: any = (payment as any).response ?? (payment as any).body ?? payment;
      preferenceId = data?.preference_id ?? data?.order?.preference_id ?? null;
      paymentStatus = data?.status ?? null;
    } else if (type === 'merchant_order') {
      // Import dinámico para no cargar el SDK entero si nunca se usa.
      const { MerchantOrder } = await import('mercadopago');
      const mo = await new MerchantOrder(mp).get({ merchantOrderId: dataId });
      const data: any = (mo as any).response ?? (mo as any).body ?? mo;
      preferenceId = data?.preference_id ?? null;
      // Tomamos el status del primer pago aprobado (o el primero si ninguno).
      const payments: any[] = Array.isArray(data?.payments) ? data.payments : [];
      const approved = payments.find((p) => p?.status === 'approved');
      const any = approved ?? payments[0];
      paymentStatus = any?.status ?? null;
      paymentId = any?.id != null ? String(any.id) : null;
    } else {
      return NextResponse.json({ ok: true, ignored: true, type });
    }
  } catch (e: any) {
    console.error('webhook: mp fetch failed', type, dataId, e?.message ?? e);
    // Respondemos 200 igual para que MP no insista con el mismo mensaje
    // si es un error de "no encontrado".
    return NextResponse.json({ ok: true, fetch_error: e?.message ?? 'unknown' });
  }

  if (!preferenceId) {
    console.warn('webhook: no preference_id in notification', type, dataId);
    return NextResponse.json({ ok: true, ignored: true, reason: 'no_preference_id' });
  }

  // 3) Localizamos la orden.
  const order = await findOrderByPreferenceId(supabase, preferenceId);
  if (!order) {
    console.warn('webhook: order not found for preference', preferenceId);
    return NextResponse.json({ ok: true, ignored: true, reason: 'order_not_found' });
  }

  const nextStatus = mapMpStatus(paymentStatus ?? undefined);

  // 4) Update idempotente: sólo avanzamos de pending → paid/cancelled.
  //    No rebajamos paid → paid si MP nos manda dos notificaciones.
  if (nextStatus !== order.status) {
    const { error } = await supabase
      .from('orders')
      .update({
        status: nextStatus,
        mp_payment_id: paymentId ?? order.mp_payment_id,
      })
      .eq('id', order.id)
      .in('status', ['pending']); // guarda: nunca bajar de paid
    if (error) {
      console.error('webhook: order update failed', error.message);
      return NextResponse.json({ ok: false, error: 'db_update_failed' }, { status: 500 });
    }
  }

  // 5) Si quedó paid, redimimos el cupón (si había uno en el carrito).
  if (nextStatus === 'paid') {
    await redeemCouponIfAny(supabase, order);
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}

/**
 * MP también puede hacer GET a este endpoint como healthcheck.
 * Respondemos 200 para que sepa que estamos vivos.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}