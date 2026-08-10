import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Payment } from 'mercadopago';
import { getMercadoPago } from '@/lib/mercadopago';
import { processPaymentResult } from '@/lib/mp-webhook';

/**
 * Webhook de notificaciones IPN/Webhooks v2 de MercadoPago.
 *
 * Seguridad:
 *   - Validamos el header `x-signature` contra un HMAC-SHA256 del
 *     template `id:[data.id];request-id:[x-request-id];ts:[ts]...`,
 *     usando `MERCADPAGO_WEBHOOK_SECRET` (configurar en el panel de la
 *     app de MP). Sin firma válida, NO procesamos.
 *   - Comparamos `payment.transaction_amount` y `currency_id` con el
 *     `total` y `currency` guardados en la orden antes de marcarla
 *     como pagada. Si difieren, NO confirmamos.
 *   - Devolvemos 5xx en errores transitorios para que MP reintente.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNATURE_HEADER = 'x-signature';
const REQUEST_ID_HEADER = 'x-request-id';

function getWebhookSecret(): string | null {
  const s = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  return s && s.length > 0 ? s : null;
}

/**
 * Verifica la firma del webhook según la documentación de MP v3:
 *   manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 *   ts es el primer componente del header x-signature separado por ","
 *   v1 es el segundo componente (hex del HMAC-SHA256 del manifest con
 *   el secret).
 *
 * Retorna true si la firma es válida o si la verificación está
 * deshabilitada (sin secret configurado). En producción, NO debe
 * estar deshabilitada.
 */
function verifyMpSignature(headers: Headers, dataId: string): {
  ok: boolean;
  reason?: 'no_secret' | 'missing_header' | 'malformed_header' | 'mismatch';
} {
  const secret = getWebhookSecret();
  if (!secret) {
    // Fail-closed en producción: si no hay secret configurado,
    // rechazamos el request. Para dev local podés setear
    // MERCADO_PAGO_WEBHOOK_SECRET_ALLOW_UNVERIFIED=1.
    if (process.env.MERCADO_PAGO_WEBHOOK_SECRET_ALLOW_UNVERIFIED === '1') {
      return { ok: true, reason: 'no_secret' };
    }
    return { ok: false, reason: 'no_secret' };
  }

  const signature = headers.get(SIGNATURE_HEADER);
  const requestId = headers.get(REQUEST_ID_HEADER);
  if (!signature || !requestId) return { ok: false, reason: 'missing_header' };

  // x-signature: "ts=...,v1=..."
  const parts = Object.fromEntries(
    signature.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return { ok: false, reason: 'malformed_header' };

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  // timingSafeEqual requiere mismo length; si no coincide, descartamos
  // sin filtrar información de timing.
  if (expected.length !== v1.length) return { ok: false, reason: 'mismatch' };
  try {
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))) {
      return { ok: false, reason: 'mismatch' };
    }
  } catch {
    return { ok: false, reason: 'malformed_header' };
  }
  return { ok: true };
}

type MpPayment = {
  id?: number | string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  preference_id?: string | null;
  order?: { preference_id?: string | null };
};

type MpMerchantOrder = {
  preference_id?: string | null;
  payments?: Array<{
    id?: number | string;
    status?: string;
    transaction_amount?: number;
    currency_id?: string;
  }>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function parseBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      return (await req.json()) as Record<string, unknown>;
    }
    // MP puede mandar application/x-www-form-urlencoded o multipart/form-data.
    // formData() soporta ambos.
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const payload = await parseBody(req);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const type = String(payload.type ?? payload.topic ?? '');
  const dataObj = (payload.data ?? null) as { id?: unknown } | null;
  const dataIdRaw = dataObj?.id ?? payload.id;
  const dataId = dataIdRaw != null ? String(dataIdRaw) : null;

  if (!type || !dataId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Topics que aceptamos. Rechazamos el resto silenciosamente.
  if (type !== 'payment' && type !== 'merchant_order') {
    return NextResponse.json({ ok: true, ignored: true, type });
  }

  // 1) Verificar firma antes de cualquier fetch a MP.
  const sig = verifyMpSignature(req.headers, dataId);
  if (!sig.ok) {
    console.warn('webhook: invalid signature', { type, dataId, reason: sig.reason });
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
  }

  const mp = getMercadoPago();
  if (!mp) {
    console.error('webhook: MERCADO_PAGO_ACCESS_TOKEN missing');
    return NextResponse.json({ ok: false, error: 'mp_not_configured' }, { status: 503 });
  }

  // 2) Fetch del recurso en MP.
  let preferenceId: string | null = null;
  let paymentStatus: string | null = null;
  let paymentId: string | null = null;
  let transactionAmount: number | null = null;
  let currencyId: string | null = null;

  try {
    if (type === 'payment') {
      paymentId = dataId;
      const payment = await new Payment(mp).get({ id: dataId });
      const data = (payment as any).response ?? (payment as any).body ?? payment;
      const d = data as MpPayment;
      preferenceId = d?.preference_id ?? d?.order?.preference_id ?? null;
      paymentStatus = d?.status ?? null;
      transactionAmount = typeof d?.transaction_amount === 'number' ? d.transaction_amount : null;
      currencyId = d?.currency_id ?? null;
    } else if (type === 'merchant_order') {
      const { MerchantOrder } = await import('mercadopago');
      const mo = await new MerchantOrder(mp).get({ merchantOrderId: dataId });
      const data = (mo as any).response ?? (mo as any).body ?? mo;
      const d = data as MpMerchantOrder;
      preferenceId = d?.preference_id ?? null;
      const payments = Array.isArray(d?.payments) ? d.payments : [];
      const approved = payments.find((p) => p?.status === 'approved');
      const any = approved ?? payments[0];
      paymentStatus = any?.status ?? null;
      paymentId = any?.id != null ? String(any.id) : null;
      transactionAmount =
        typeof any?.transaction_amount === 'number' ? any.transaction_amount : null;
      currencyId = any?.currency_id ?? null;
    }
  } catch (e: any) {
    // Error transitorio: devolvemos 5xx para que MP reintente.
    console.error('webhook: mp fetch failed', { type, dataId, message: e?.message });
    return NextResponse.json(
      { ok: false, error: 'upstream_unavailable' },
      { status: 502 }
    );
  }

  if (!preferenceId) {
    console.warn('webhook: no preference_id', { type, dataId });
    return NextResponse.json({ ok: true, ignored: true, reason: 'no_preference_id' });
  }

  // 3) Validar monto/currency antes de confirmar.
  if (transactionAmount !== null && currencyId) {
    const { getServiceSupabase } = await import('@/lib/supabase-admin');
    const supabase = getServiceSupabase();
    if (supabase) {
      const { data: order } = await supabase
        .from('orders')
        .select('total, currency, status')
        .eq('mp_preference_id', preferenceId)
        .maybeSingle();
      if (order) {
        const expectedTotal = Number(order.total);
        const expectedCurrency = order.currency;
        if (
          !Number.isFinite(expectedTotal) ||
          round2(expectedTotal) !== round2(transactionAmount) ||
          expectedCurrency !== currencyId
        ) {
          console.error('webhook: amount/currency mismatch', {
            preferenceId,
            expected: { total: expectedTotal, currency: expectedCurrency },
            got: { total: transactionAmount, currency: currencyId },
            paymentStatus,
          });
          return NextResponse.json(
            { ok: false, error: 'amount_mismatch' },
            { status: 409 }
          );
        }
      }
    }
  }

  const result = await processPaymentResult({
    preferenceId,
    paymentId,
    paymentStatus: paymentStatus ?? undefined,
  });

  if (!result) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'order_not_found' });
  }

  return NextResponse.json({ ok: true, status: result.nextStatus, order_id: result.orderId });
}

/**
 * Healthcheck para curl manual.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}