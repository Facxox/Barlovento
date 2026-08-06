import { NextRequest, NextResponse } from 'next/server';
import { Preference } from 'mercadopago';
import { getMercadoPago } from '@/lib/mercadopago';
import { getServiceSupabase } from '@/lib/supabase-admin';

type Item = {
  id?: string;
  name: string;
  qty: number;
  price: number;
  currency: string;
};

type Body = {
  items: Item[];
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

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

  const mp = getMercadoPago();
  if (!mp) {
    return NextResponse.json(
      { ok: false, error: 'mercadopago_not_configured' },
      { status: 503 }
    );
  }

  const preference = new Preference(mp);

  const currency = body.items[0]?.currency ?? 'UYU';
  const total = body.items.reduce((acc, it) => acc + it.qty * it.price, 0);

  let initPoint = '';
  let preferenceId: string | null = null;

  try {
    const created = await preference.create({
      body: {
        items: body.items.map((it) => ({
          id: it.id ?? '',
          title: it.name,
          quantity: it.qty,
          unit_price: Number(it.price),
          currency_id: it.currency,
        })),
        payer: {
          name: body.customer_name ?? undefined,
          phone: body.customer_phone
            ? { number: body.customer_phone }
            : undefined,
          email: body.customer_email ?? undefined,
        },
        back_urls: {
          success: `${siteUrl()}/checkout/success`,
          failure: `${siteUrl()}/checkout/failure`,
          pending: `${siteUrl()}/checkout/pending`,
        },
        auto_return: 'approved',
        statement_descriptor: 'Barlovento',
        metadata: {
          source: 'web',
        },
      },
    });
    initPoint = created.init_point ?? '';
    preferenceId = created.id ?? null;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'mp_error' },
      { status: 502 }
    );
  }

  // Persist order via service role (bypasses RLS — Mercado Pago channel).
  const supabase = getServiceSupabase();
  if (supabase) {
    const { error } = await supabase.from('orders').insert({
      channel: 'mercadopago',
      status: 'pending',
      items: body.items.map((it) => ({
        id: it.id,
        name: it.name,
        qty: it.qty,
        price: it.price,
      })),
      total,
      currency,
      customer_name: body.customer_name ?? null,
      customer_phone: body.customer_phone ?? null,
      customer_email: body.customer_email ?? null,
      mp_preference_id: preferenceId,
    });
    if (error) {
      // Don't block redirect — log and continue.
      console.error('orders insert failed', error.message);
    }
  }

  return NextResponse.json({ ok: true, init_point: initPoint, preference_id: preferenceId });
}