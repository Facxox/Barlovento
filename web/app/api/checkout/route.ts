import { NextRequest, NextResponse } from 'next/server';
import { Preference } from 'mercadopago';
import { getMercadoPago } from '@/lib/mercadopago';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { validateContainerOrder, persistOrderCompositions } from '@/lib/container-orders';

type ClientItem = {
  id?: string;
  name?: string;
  qty?: unknown;
  price?: unknown;
  currency?: string;
  /** Si la línea es un contenedor, los hijos que el cliente eligió. */
  composition?: Array<{ child_product_id: string; qty: number }>;
};

type ValidatedItem = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  currency: string;
  units_per_pack: number;
  kind?: 'container';
  parentLineId?: string;
  composition?: Array<{
    child_product_id: string;
    child_name: string;
    qty: number;
    unit_price: number;
    currency: string;
    child_image: string | null;
  }>;
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
  /**
   * Costo de envío propuesto por el cliente. Lo recalculamos
   * server-side según la cantidad de alfajores y lo aceptamos solo si
   * coincide con la política fija (0, 195, 220).
   */
  shipping_cost?: number | null;
  shipping_currency?: string | null;
  /**
   * Modalidad de entrega. 'shipping' (default) envía a domicilio.
   * 'pickup' fuerza envío a 0 y marca la orden como retiro
   * coordinado por WhatsApp.
   */
  fulfillment?: 'shipping' | 'pickup' | null;
};

const MAX_ITEMS = 50;
const MAX_QTY = 99;
const MAX_STRING = 500;
const SUPPORTED_CURRENCIES = ['UYU', 'USD', 'ARS', 'BRL', 'CLP', 'MXN', 'COP', 'PEN'] as const;
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// Política de envío fijo (UYU). Coincide con la constante en
// app/checkout/CheckoutForm.tsx. La fuente de verdad es el server.
const SHIPPING_LE_20 = 195;
const SHIPPING_MAS_20 = 220;
const SHIPPING_THRESHOLD = 20;
const VALID_SHIPPING_VALUES = new Set([0, SHIPPING_LE_20, SHIPPING_MAS_20]);

function calcShippingCost(alfajores: number): number {
  if (alfajores <= 0) return 0;
  return alfajores > SHIPPING_THRESHOLD ? SHIPPING_MAS_20 : SHIPPING_LE_20;
}

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
    if (typeof it.price === 'number' && (!Number.isFinite(it.price) || it.price < 0)) {
      return 'invalid_price';
    }
    // Composición de contenedor: validar superficialmente, la
    // validación dura la hace validateContainerOrder server-side.
    if (Array.isArray(it.composition)) {
      if (it.composition.length === 0) return 'empty_container_composition';
      for (const line of it.composition) {
        if (
          !line ||
          typeof line !== 'object' ||
          typeof line.child_product_id !== 'string' ||
          typeof line.qty !== 'number' ||
          !Number.isInteger(line.qty) ||
          line.qty < 1
        ) {
          return 'invalid_container_composition';
        }
      }
    }
  }

  // Shipping enviado por el cliente: sólo aceptamos 0/195/220.
  if (body.shipping_cost !== undefined && body.shipping_cost !== null) {
    if (
      typeof body.shipping_cost !== 'number' ||
      !Number.isFinite(body.shipping_cost) ||
      !VALID_SHIPPING_VALUES.has(body.shipping_cost)
    ) {
      return 'invalid_shipping_cost';
    }
    if (body.shipping_currency !== undefined && body.shipping_currency !== null) {
      if (typeof body.shipping_currency !== 'string') return 'invalid_shipping_currency';
      const sc = body.shipping_currency.trim().toUpperCase();
      if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(sc)) {
        return 'invalid_shipping_currency';
      }
    }
  }

  // Fulfillment.
  if (body.fulfillment !== undefined && body.fulfillment !== null) {
    if (typeof body.fulfillment !== 'string') return 'invalid_fulfillment';
    const f = body.fulfillment.trim().toLowerCase();
    if (f !== 'shipping' && f !== 'pickup') return 'invalid_fulfillment';
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

  // 1) Resolver todo el carrito contra la DB. Esta función valida
  //    productos normales Y contenedores (incluido el cálculo de precio
  //    server-side y de Σ unidades físicas para envío). Devuelve errores
  //    específicos si algo no cuadra.
  const clientItems = (body.items ?? []).map((it) => ({
    id: asNonEmptyString(it.id, 100) ?? '',
    name: typeof it.name === 'string' ? it.name : undefined,
    qty: asPositiveInt(it.qty) ?? 1,
    price: typeof it.price === 'number' ? it.price : undefined,
    currency: typeof it.currency === 'string' ? it.currency : undefined,
    composition: Array.isArray(it.composition) ? it.composition : undefined,
  }));

  const validation = await validateContainerOrder(clientItems);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid_cart', details: validation.errors },
      { status: 400 }
    );
  }
  const validated = validation.validated as ValidatedItem[];
  const subtotal = validation.totals.subtotal;
  const totalAlfajores = validation.totals.alfajores;
  let shippingCost = validation.totals.shippingCost;
  const persistableCompositions = validation.persistableCompositions;

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

// Modalidad: pickup fuerza envío = 0 y prepara la orden para la
// coordinación por WhatsApp.
const rawFulfillment =
  typeof body.fulfillment === 'string'
    ? body.fulfillment.trim().toLowerCase()
    : 'shipping';
const fulfillment: 'shipping' | 'pickup' =
  rawFulfillment === 'pickup' ? 'pickup' : 'shipping';
if (fulfillment === 'pickup') {
  shippingCost = 0;
}

  // 4) Resolver sesión y customer_type ANTES del cupón para poder pasar
  //    el userId a la validación de cupones.
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
    }
  }

  // Wholesale bloqueado para MP: el botón en el carrito está oculto
  // pero igual validamos server-side.
  if (customerType === 'wholesale') {
    return NextResponse.json(
      { ok: false, error: 'wholesale_blocked_from_mp' },
      { status: 403 }
    );
  }

  // 5) Cupón opcional: se revalida server-side y se aplica al total.
  let couponDiscount = 0;
  let couponCode: string | null = null;
  let couponId: string | null = null;
  let couponCurrency: string | null = null;

  if (body.coupon_code) {
    const { validateCouponForCheckout } = await import('@/lib/coupon-checkout');
    // Categoría: para los contenedores no la seteamos (los cupones no
    // aplican sobre líneas custom). Si hace falta, el admin puede
    // crear un cupón específico que matchee por id.
    const cartForCoupon = validated.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.kind === 'container' ? '' : '',
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

  const total = Math.max(0, subtotal - couponDiscount + shippingCost);

  // 5) Datos del cliente saneados.
  const customer = {
    name: cleanText(body.customer_name, 200),
    email: cleanText(body.customer_email, 200),
    phone: cleanText(body.customer_phone, 50),
    address: cleanText(body.customer_address, 300),
    city: cleanText(body.customer_city, 100),
    notes: cleanText(body.customer_notes, 500),
  };

  // 6) Si el cliente está autenticado, sobrescribimos el email con el
  //    de la cuenta (no confiamos en lo que mandó en el form).
  //    userId y customerType ya se resolvieron arriba (paso 4).
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle();
    if (profile?.email) customer.email = profile.email;
  }

  // 7) Pre-persisto la orden (status=pending, sin mp_preference_id).
  //    Si falla la persistencia, NO creamos preference en MP — eso
  //    evita preferences huérfanas sin orden que matchear.
  const itemsForDb: Array<{
    id: string;
    name: string;
    qty: number;
    price: number;
    currency: string;
    composition?: Array<{
      child_product_id: string;
      child_name: string;
      qty: number;
      unit_price: number;
      currency: string;
      child_image: string | null;
    }>;
  }> = validated.map((v) => ({
    id: v.id,
    name: v.name,
    qty: v.qty,
    price: v.unit_price,
    currency: v.currency,
    composition: v.composition,
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
  if (shippingCost > 0) {
    itemsForDb.push({
      id: 'shipping',
      name: 'Envío',
      qty: 1,
      price: shippingCost,
      currency,
    });
  } else if (fulfillment === 'pickup') {
    itemsForDb.push({
      id: 'pickup',
      name: 'Retiro coordinado por WhatsApp',
      qty: 1,
      price: 0,
      currency,
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
      shipping_cost: shippingCost,
      shipping_currency: shippingCost > 0 ? currency : null,
      fulfillment,
      pickup_status: fulfillment === 'pickup' ? 'awaiting_coordination' : null,
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

  // 7b) Persistir las composiciones de contenedores en la tabla
  //     order_container_items. Esta tabla snapshot nombre/precio del
  //     hijo en el momento de la compra. Si falla, NO cancelamos la
  //     orden — los datos siguen vivos dentro de orders.items (jsonb).
  if (orderId && persistableCompositions.length > 0) {
    await persistOrderCompositions(orderId, persistableCompositions);
  }

  // 8) Crear preference en MP.
  const preference = new Preference(mp);
  let initPoint = '';
  let preferenceId: string | null = null;

  try {
    // Para MP, los contenedores se "aplanan" a líneas por child item
    // (MP no soporta líneas con sub-ítems). Sumamos base (si la hay en
    // modo replace) como una línea separada, y cada hijo se cobra
    // multiplicando unit_price × qty dentro del contenedor, escalado
    // por la qty del contenedor.
    const mpItems: Array<{
      id: string;
      title: string;
      quantity: number;
      unit_price: number;
      currency_id: string;
    }> = [];
    for (const v of validated) {
      if (v.kind === 'container' && v.composition && v.composition.length > 0) {
        // Si parte del precio es "base" (config.base_plus_content),
        // emitimos esa línea aparte.
        // Para no replicar pricing acá, simplemente emitimos 1 línea
        // con title descriptivo y unit_price=total. El detalle real se
        // persistió en order_container_items.
        // Sumamos una línea por hijo, quantity = contenedor.qty * child.qty
        for (const child of v.composition) {
          mpItems.push({
            id: `${v.id}::${child.child_product_id}`,
            title: `${v.name} — ${child.child_name}`,
            quantity: v.qty * child.qty,
            unit_price: Number(child.unit_price),
            currency_id: v.currency,
          });
        }
        // Si quedó una base no cubierta por los hijos (replace /
        // base_plus_content con base>0 cuando los hijos suman 0),
        // emitimos esa diferencia como línea para que cuadre con
        // orders.total. La persistencia sigue mostrando el desglose.
        const covered = v.composition.reduce(
          (a, c) => a + c.unit_price * c.qty,
          0
        );
        const rest = Math.max(0, Number(v.unit_price) - covered);
        if (rest > 0.0001) {
          mpItems.push({
            id: `${v.id}::base`,
            title: `${v.name} — base`,
            quantity: v.qty,
            unit_price: Number(rest.toFixed(2)),
            currency_id: v.currency,
          });
        }
      } else {
        mpItems.push({
          id: v.id,
          title: v.name,
          quantity: v.qty,
          unit_price: Number(v.unit_price),
          currency_id: v.currency,
        });
      }
    }

    const created = await preference.create({
      body: {
        items: [
          ...mpItems,
          // Línea de envío (cobrada junto con el pedido). Sólo si > 0.
          ...(shippingCost > 0
            ? [
                {
                  id: 'shipping',
                  title: 'Envío',
                  quantity: 1,
                  unit_price: Number(shippingCost),
                  currency_id: currency,
                },
              ]
            : []),
        ],
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
        // external_reference permite que las páginas de retorno
        // (/checkout/success, /pending) recuperen la orden sin
        // depender de la metadata que se pierde en algunos flows.
        external_reference: String(orderId),
        metadata: {
          source: 'web',
          order_id: orderId,
          fulfillment,
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