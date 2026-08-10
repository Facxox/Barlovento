import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { Payment } from 'mercadopago';
import { getMercadoPago } from '@/lib/mercadopago';
import { processPaymentResult } from '@/lib/mp-webhook';

/**
 * Webhook de notificaciones IPN/Webhooks v2 de MercadoPago.
 *
 * Topics manejados:
 *   - payment         → un pago puntual
 *   - merchant_order  → orden de checkout (puede tener varios payments)
 *
 * Respondemos 200 rápido para evitar reintentos.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
  const dataObj = (payload.data ?? null) as { id?: unknown } | null;
  const dataIdRaw = dataObj?.id ?? payload.id;
  const dataId = dataIdRaw != null ? String(dataIdRaw) : null;

  if (!type || !dataId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const mp = getMercadoPago();
  if (!mp) {
    console.error('webhook: MERCADO_PAGO_ACCESS_TOKEN missing');
    return NextResponse.json({ ok: false, error: 'mp_not_configured' }, { status: 503 });
  }

  let preferenceId: string | null = null;
  let paymentStatus: string | null = null;
  let paymentId: string | null = null;

  try {
    if (type === 'payment') {
      paymentId = dataId;
      const payment = await new Payment(mp).get({ id: dataId });
      const data: any = (payment as any).response ?? (payment as any).body ?? payment;
      preferenceId = data?.preference_id ?? data?.order?.preference_id ?? null;
      paymentStatus = data?.status ?? null;
    } else if (type === 'merchant_order') {
      const { MerchantOrder } = await import('mercadopago');
      const mo = await new MerchantOrder(mp).get({ merchantOrderId: dataId });
      const data: any = (mo as any).response ?? (mo as any).body ?? mo;
      preferenceId = data?.preference_id ?? null;
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
    return NextResponse.json({ ok: true, fetch_error: e?.message ?? 'unknown' });
  }

  if (!preferenceId) {
    console.warn('webhook: no preference_id in notification', type, dataId);
    return NextResponse.json({ ok: true, ignored: true, reason: 'no_preference_id' });
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
 * Healthcheck para MP / curl manual.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}