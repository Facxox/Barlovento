import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  validateContainerOrder,
  persistOrderCompositions,
} from '@/lib/container-orders';

type LineIn = {
  id: string;
  name: string;
  qty: number;
  price: number;
  unitsPerPack?: number;
  composition?: Array<{ child_product_id: string; qty: number }>;
};

type Body = {
  items: LineIn[];
  total: number;
  currency: string;
  shipping_cost?: number;
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

  // Validación server-side de productos + composiciones de contenedor.
  // Esto SIEMPRE corre, sin importar el canal.
  const validation = await validateContainerOrder(
    body.items.map((i) => ({
      id: i.id,
      qty: i.qty,
      price: i.price,
      composition: i.composition,
    }))
  );

  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid_cart', details: validation.errors },
      { status: 400 }
    );
  }

  // Para mayoristas: 6 unidades POR línea de producto normal.
  // Para contenedores: la qty del contenedor debe ser >= 6 (cada
  // contenedor cuenta 1). Si el cliente pide 1 lata y la lata trae
  // 6 alfajores, ya cumplimos la regla del mínimo de alfajores físicos.
  if (body.customer_type === 'wholesale') {
    const below: { id: string; name: string; qty: number }[] = [];
    for (const v of validation.validated) {
      const original = body.items.find((it) => it.id === v.id);
      if (!original) continue;
      const minQty = v.kind === 'container' ? 1 : WHOLESALE_MIN_QTY;
      if (v.qty < minQty) {
        below.push({ id: v.id, name: v.name, qty: v.qty });
      }
    }
    if (below.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'wholesale_min_qty',
          min: WHOLESALE_MIN_QTY,
          below,
        },
        { status: 400 }
      );
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  // itemsForDb: items enriquecidos con la composición validada.
  const itemsForDb = validation.validated.map((v) => ({
    id: v.id,
    name: v.name,
    qty: v.qty,
    price: v.unit_price,
    currency: v.currency,
    composition: v.composition,
  }));

  // El total que guardamos es el que el server calculó (subtotal de
  // los items validados, no el que mandó el cliente). Alineado con el
  // MP checkout.
  const storedTotal = validation.totals.total;

  const { data: inserted, error } = await supabase
    .from('orders')
    .insert({
      channel: 'whatsapp',
      status: 'pending',
      items: itemsForDb,
      total: storedTotal,
      currency: body.currency,
      customer_name: body.customer_name ?? null,
      customer_phone: body.customer_phone ?? null,
      customer_type:
        body.customer_type === 'wholesale' ? 'wholesale' : 'retail',
      shipping_cost: body.shipping_cost ?? null,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'order_persist_failed' },
      { status: 500 }
    );
  }

  const orderId = (inserted as { id: number }).id;

  if (validation.persistableCompositions.length > 0) {
    await persistOrderCompositions(orderId, validation.persistableCompositions);
  }

  return NextResponse.json({ ok: true, order_id: orderId, total: storedTotal });
}
