import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  validateContainerOrder,
  persistOrderCompositions,
} from '@/lib/container-orders';

type Body = {
  items: Array<{
    id?: string;
    name?: string;
    qty: number;
    price: number;
    currency?: string;
    composition?: Array<{ child_product_id: string; qty: number }>;
  }>;
  total: number;
  shipping_cost?: number;
  shipping_currency?: string;
  currency: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_notes?: string | null;
  customer_type?: 'retail' | 'wholesale' | string;
  coupon_code?: string | null;
  fulfillment?: 'shipping' | 'pickup' | null;
  receipt_url?: string | null;
};

const MAX_ITEMS = 50;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ ok: false, error: 'empty_cart' }, { status: 400 });
  }
  if (body.items.length > MAX_ITEMS) {
    return NextResponse.json({ ok: false, error: 'too_many_items' }, { status: 400 });
  }

  // Validación server-side: productos normales y contenedores. Esta
  // función es la misma que usa el checkout de MP y el de WhatsApp.
  const validation = await validateContainerOrder(
    body.items.map((it) => ({
      id: String(it.id ?? it.name ?? ''),
      qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
      price: Number(it.price) || 0,
      currency: it.currency,
      composition: Array.isArray(it.composition) ? it.composition : undefined,
    }))
  );
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid_cart', details: validation.errors },
      { status: 400 }
    );
  }

  const receiptUrl =
    typeof body.receipt_url === 'string' &&
    /^https?:\/\/[^\s]{8,500}$/.test(body.receipt_url.trim())
      ? body.receipt_url.trim()
      : null;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  // El total que guardamos es el que el server calculó (subtotal de
  // validación + envío server-side). El del cliente se ignora.
  const itemsForDb = validation.validated.map((v) => ({
    id: v.id,
    name: v.name,
    qty: v.qty,
    price: v.unit_price,
    currency: v.currency,
    composition: v.composition,
  }));

  const { data, error } = await supabase
    .from('orders')
    .insert({
      channel: 'bank_transfer',
      status: 'pending',
      items: itemsForDb,
      total: validation.totals.total,
      currency: body.currency,
      shipping_cost: validation.totals.shippingCost || null,
      shipping_currency: validation.totals.shippingCost > 0 ? body.currency : null,
      customer_name: body.customer_name ?? null,
      customer_phone: body.customer_phone ?? null,
      customer_email: body.customer_email ?? null,
      customer_address: body.customer_address ?? null,
      customer_city: body.customer_city ?? null,
      customer_notes: body.customer_notes ?? null,
      customer_type:
        body.customer_type === 'wholesale' ? 'wholesale' : 'retail',
      coupon_code: body.coupon_code ?? null,
      fulfillment: body.fulfillment === 'pickup' ? 'pickup' : 'shipping',
      receipt_url: receiptUrl,
    })
    .select('id, receipt_url')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'insert_failed' },
      { status: 500 }
    );
  }

  const orderId = (data as { id: number }).id;
  if (validation.persistableCompositions.length > 0) {
    await persistOrderCompositions(orderId, validation.persistableCompositions);
  }

  return NextResponse.json({ ok: true, order_id: orderId });
}
