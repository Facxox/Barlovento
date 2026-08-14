import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';

type Body = {
  items: Array<{ id?: string; name?: string; qty: number; price: number; currency?: string }>;
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
const MAX_QTY = 99;
const MAX_STRING = 500;

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

  const items = body.items
    .map((it) => ({
      id: typeof it.id === 'string' ? it.id : String(it.name ?? ''),
      name: String(it.name ?? '').slice(0, MAX_STRING),
      qty: Math.max(1, Math.min(MAX_QTY, Math.floor(Number(it.qty) || 1))),
      price: Math.max(0, Number(it.price) || 0),
      currency: typeof it.currency === 'string' ? it.currency : body.currency,
    }))
    .filter((it) => it.name && it.qty > 0);

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'empty_cart' }, { status: 400 });
  }

  const total = Math.max(0, Number(body.total) || 0);
  const shippingCost = Math.max(0, Number(body.shipping_cost) || 0);
  // Validamos que receipt_url sea una URL http(s) razonable, no un string
  // arbitrario. Si no pasa, lo descartamos en silencio (el campo es opcional).
  const receiptUrl =
    typeof body.receipt_url === 'string' &&
    /^https?:\/\/[^\s]{8,500}$/.test(body.receipt_url.trim())
      ? body.receipt_url.trim()
      : null;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      channel: 'bank_transfer',
      status: 'pending',
      items,
      total,
      currency: body.currency,
      shipping_cost: shippingCost || null,
      shipping_currency: body.shipping_currency ?? body.currency,
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

  return NextResponse.json({ ok: true, order_id: data.id });
}
