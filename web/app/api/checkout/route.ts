import { NextRequest, NextResponse } from 'next/server';
import { Preference } from 'mercadopago';
import { getMercadoPago } from '@/lib/mercadopago';
import { getServiceSupabase } from '@/lib/supabase-admin';

type ClientItem = {
  id?: string;
  name?: string;
  qty?: unknown;
  price?: unknown;
  currency?: string;
};

type ValidatedItem = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  currency: string;
};

type Body = {
  items?: ClientItem[];
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_notes?: string | null;
  /**
   * Coupon canónico que el cliente dice estar aplicando. Lo
   * revalidamos server-side contra el carrito autoritativo.
   */
  coupon_code?: string | null;
};

const MAX_ITEMS = 50;
const MAX_QTY = 99;
const MAX_STRING = 500;
const SUPPORTED_CURRENCIES = ['UYU', 'USD', 'ARS', 'BRL', 'CLP', 'MXN', 'COP', 'PEN'] as const;
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

function siteUrlFor(path: string): string {
  const base = siteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function asNonEmptyString(v: unknown, max = MAX_STRING): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > MAX_QTY) {
    return null;
  }
  return n;
}

/**
 * Sanitiza un string de input del cliente (nombre, dirección, etc.).
 * Limita longitud y recorta caracteres de control que rompen logs / DB.
 */
function cleanText(v: unknown, max = MAX_STRING): string | null {
  const s = asNonEmptyString(v, max);
  if (s === null) return null;
  // Quitamos saltos de línea y control chars, pero dejamos tildes/ñ/etc.
  return s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Valida el cuerpo del request. Devuelve null si pasa o un string con el código de error.
 * No loguea contenido del cliente para evitar PII en stdout.
 */
function validateBody(body: Body): string | null {
  if (!body || typeof body !== 'object') return 'invalid_json';
  if (!Array.isArray(body.items) || body.items.length === 0) return 'empty_cart';
  if (body.items.length > MAX_ITEMS) return 'cart_too_large';

  for (const it of body.items) {
    if (!it || typeof it !== 'object') return 'invalid_item';
    const id = asNonEmptyString(it.id, 100);
    if (!id) return 'invalid_item_id';
    if (id.startsWith('coupon:')) return 'coupon_line_not_allowed';
    const qty = asPositiveInt(it.qty);
    if (qty === null) return 'invalid_qty';
    // precio NO se valida acá: viene del server-side lookup. Sólo
    // descartamos negativos o NaN provistos por el cliente.
    if (typeof it.price === 'number' && (!Number.isFinite(it.price) || it.price < 0)) {
      return 'invalid_price';
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const validationError = validateBody(body);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const mp = getMercadoPago();
  if (!mp) {
    return NextResponse.json(
      { ok: false, error: 'mercadopago_not_configured' },
      { status: 503 }
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'db_unavailable' },
      { status: 503 }
    );
  }

  // 1) Resolver productos server-side. Los IDs vienen del cliente,
  //    pero el nombre, precio y currency salen de la DB.
  const itemIds = (body.items ?? []).map((it) => asNonEmptyString(it.id, 100)!).filter(Boolean);

  //零售 minorista. Buscamos en ambas tablas (retail y wholesale) para
  // aceptar pedidos de cualquier canal; el filtrado por canal lo hace
  // la política del producto al elegir a cuál tabla pertenece.
  const [retailRows, wholesaleRows] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, currency, is_active, category, image')
      .in('id', itemIds)
      .eq('is_active', true),
    supabase
      .from('wholesale_products')
      .select('id, name, price, currency, is_active, category, image')
      .in('id', itemIds)
      .eq('is_active', true),
  ]);

  type CatalogRow = {
    id: string;
    name: string;
    price: number;
    currency: string;
    category?: string;
    image?: string;
  };

  const catalog = new Map<string, CatalogRow>();
  for (const r of (retailRows.data ?? []) as CatalogRow[]) {
    catalog.set(r.id, r);
  }
  for (const r of (wholesaleRows.data ?? []) as CatalogRow[]) {
    if (!catalog.has(r.id)) catalog.set(r.id, r); // retail tiene prioridad si está en ambas
  }

  // 2) Construir items validados.
  const validated: ValidatedItem[] = [];
  for (const it of body.items ?? []) {
    const id = asNonEmptyString(it.id, 100)!;
    const row = catalog.get(id);
    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'product_not_found', product_id: id },
        { status: 400 }
      );
    }
    const qty = asPositiveInt(it.qty)!;
    const currency = row.currency || 'UYU';
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
      return NextResponse.json(
        { ok: false, error: 'unsupported_currency', currency },
        { status: 400 }
      );
    }
    const unitPrice = Number(row.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json(
        { ok: false, error: 'invalid_catalog_price', product_id: id },
        { status: 500 }
      );
    }
    validated.push({
      id: row.id,
      name: row.name,
      qty,
      unit_price: unitPrice,
      currency,
    });
  }

  // 3) Forzar una sola moneda en todo el carrito.
  const currency = validated[0]?.currency ?? 'UYU';
  for (const v of validated) {
    if (v.currency !== currency) {
      return NextResponse.json(
        { ok: false, error: 'mixed_currencies' },
        { status: 400 }
      );
    }
  }

  const subtotal = validated.reduce((acc, v) => acc + v.qty * v.unit_price, 0);

  // 4) Cupón opcional: se revalida server-side y se aplica al total.
  let couponDiscount = 0;
  let couponCode: string | null = null;
  let couponId: string | null = null;
  let couponCurrency: string | null = null;

  if (body.coupon_code) {
    const { validateCouponForCheckout } = await import('@/lib/coupon-checkout');
    const cartForCoupon = validated.map((v) => ({
      id: v.id,
      name: v.name,
      category: catalog.get(v.id)?.category ?? '',
      qty: v.qty,
      price: v.unit_price,
      currency: v.currency,
    }));
    const customerEmail = cleanText(body.customer_email, 200);
    const result = await validateCouponForCheckout({
      supabase,
      code: body.coupon_code,
      cart: cartForCoupon,
      customerEmail,
      userId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'invalid_coupon', code: result.code },
        { status: 400 }
      );
    }
    couponDiscount = Math.min(result.discount_total, subtotal);
    couponCode = result.code;
    couponId = result.coupon_id;
    couponCurrency = result.currency;
    if (result.currency !== currency) {
      return NextResponse.json(
        { ok: false, error: 'coupon_currency_mismatch' },
        { status: 400 }
      );
    }
  }

  const total = Math.max(0, subtotal - couponDiscount);

  // 5) Datos del cliente saneados.
  const customer = {
    name: cleanText(body.customer_name, 200),
    email: cleanText(body.customer_email, 200),
    phone: cleanText(body.customer_phone, 50),
    address: cleanText(body.customer_address, 300),
    city: cleanText(body.customer_city, 100),
    notes: cleanText(body.customer_notes, 500),
  };

  // 6) Resolver customer_type desde la sesión autenticada. Ya NO se
  //    confía en el email del cliente.
  const { getServerSupabase } = await import('@/lib/supabase-server');
  const serverSupabase = await getServerSupabase();
  let userId: string | null = null;
  let customerType: 'retail' | 'wholesale' = 'retail';
  if (serverSupabase) {
    const { data: userData } = await serverSupabase.auth.getUser();
    userId = userData?.user?.id ?? null;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('customer_type, email')
        .eq('user_id', userId)
        .maybeSingle();
      if (profile?.customer_type === 'wholesale') customerType = 'wholesale';
      // Si el cliente está autenticado, usamos su email de la cuenta,
      // no lo que mandó en el form.
      if (profile?.email) customer.email = profile.email;
    }
  }

  // Wholesale está bloqueado para pagos por MP. Mayoristas usan
  // WhatsApp. Si un wholesale user llega acá, devolvemos 403.
  if (customerType === 'wholesale') {
    return NextResponse.json(
      { ok: false, error: 'wholesale_blocked_from_mp' },
      { status: 403 }
    );
  }

  // 7) Pre-persisto la orden (status=pending, sin mp_preference_id).
  //    Si falla la persistencia, NO creamos preference en MP — eso
  //    evita preferences huérfanas sin orden que matchear.
  const itemsForDb = validated.map((v) => ({
    id: v.id,
    name: v.name,
    qty: v.qty,
    price: v.unit_price,
    currency: v.currency,
  }));
  if (couponCode && couponId) {
    itemsForDb.push({
      id: `coupon:${couponId}`,
      name: `Cupón ${couponCode}`,
      qty: 1,
      price: -couponDiscount,
      currency: currency,
    });
  }

  let orderId: number | null = null;
  const { data: inserted, error: insertErr } = await supabase
    .from('orders')
    .insert({
      channel: 'mercadopago',
      status: 'pending',
      customer_type: customerType,
      items: itemsForDb,
      total,
      currency,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email,
      customer_address: customer.address,
      customer_city: customer.city,
      customer_notes: customer.notes,
      user_id: userId,
      coupon_code: couponCode,
      coupon_discount: couponDiscount > 0 ? couponDiscount : null,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    console.error('orders insert failed', insertErr?.message);
    return NextResponse.json(
      { ok: false, error: 'order_persist_failed' },
      { status: 500 }
    );
  }
  orderId = (inserted as { id: number }).id;

  // 8) Crear preference en MP.
  const preference = new Preference(mp);
  let initPoint = '';
  let preferenceId: string | null = null;

  try {
    const created = await preference.create({
      body: {
        items: validated.map((v) => ({
          id: v.id,
          title: v.name,
          quantity: v.qty,
          unit_price: Number(v.unit_price),
          currency_id: v.currency,
        })),
        payer: {
          name: customer.name ?? undefined,
          phone: customer.phone ? { number: customer.phone } : undefined,
          email: customer.email ?? undefined,
        },
        back_urls: {
          success: siteUrlFor('/checkout/success'),
          failure: siteUrlFor('/checkout/failure'),
          pending: siteUrlFor('/checkout/pending'),
        },
        auto_return: 'approved',
        notification_url: siteUrlFor('/api/webhook/mp'),
        statement_descriptor: 'Barlovento',
        metadata: {
          source: 'web',
          order_id: orderId,
          customer_address: customer.address,
          customer_city: customer.city,
          customer_notes: customer.notes,
        },
      },
    });
    initPoint = created.init_point ?? '';
    preferenceId = created.id ?? null;
  } catch (err: any) {
    // Scrubbing: NO devolvemos err.message al cliente. Logueamos
    // server-side para diagnóstico.
    console.error('mp preference create failed', {
      order_id: orderId,
      message: err?.message,
      code: err?.code,
      status: err?.status,
    });
    // Marcamos la orden como cancelada para no dejar huérfanas con
    // status pending que nunca van a pagar.
    await supabase
      .from('orders')
      .update({ status: 'cancelled', mp_payment_id: null })
      .eq('id', orderId);
    return NextResponse.json(
      { ok: false, error: 'mp_error' },
      { status: 502 }
    );
  }

  // 9) Guardar preference_id en la orden para que el webhook la encuentre.
  if (preferenceId) {
    const { error: linkErr } = await supabase
      .from('orders')
      .update({ mp_preference_id: preferenceId })
      .eq('id', orderId)
      .is('mp_preference_id', null);
    if (linkErr) {
      console.error('order link preference failed', linkErr.message);
    }
  }

  return NextResponse.json({
    ok: true,
    init_point: initPoint,
    preference_id: preferenceId,
    order_id: orderId,
  });
}