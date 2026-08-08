import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';

type Body = {
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  currency: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_type?: 'retail' | 'wholesale' | string;
};

const WHOLESALE_MIN_QTY = 6;

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

  // Mayoristas: pedido mínimo de 6 unidades por producto.
  if (body.customer_type === 'wholesale') {
    const below = body.items.filter((i) => !i.qty || i.qty < WHOLESALE_MIN_QTY);
    if (below.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'wholesale_min_qty',
          min: WHOLESALE_MIN_QTY,
          below: below.map((i) => ({ name: i.name, qty: i.qty })),
        },
        { status: 400 }
      );
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const { error } = await supabase.from('orders').insert({
    channel: 'whatsapp',
    status: 'pending',
    items: body.items,
    total: body.total,
    currency: body.currency,
    customer_name: body.customer_name ?? null,
    customer_phone: body.customer_phone ?? null,
    customer_type:
      body.customer_type === 'wholesale' ? 'wholesale' : 'retail',
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}