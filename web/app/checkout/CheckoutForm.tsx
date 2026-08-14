'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartContext';
import GoldDivider from '@/components/GoldDivider';
import CouponInput, { type AppliedCouponState } from '@/components/CouponInput';
import { formatMoney } from '@/components/formatMoney';
import { compressImage } from '@/lib/imageCompress';

type Profile = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
} | null;

type FieldErrors = Partial<
  Record<'full_name' | 'email' | 'phone' | 'address' | 'city', string>
>;

const formatUY = (n: number) => formatMoney(n);

// Política de envío fijo. Se cobra junto con el pedido en Mercado Pago.
// Hasta 20 alfajores → $195. Más de 20 → $220. Aplica a cualquier destino.
const SHIPPING_LE_20 = 195;
const SHIPPING_MAS_20 = 220;
const SHIPPING_THRESHOLD = 20;

function calcShippingCost(alfajores: number): number {
  if (alfajores <= 0) return 0;
  return alfajores > SHIPPING_THRESHOLD ? SHIPPING_MAS_20 : SHIPPING_LE_20;
}

export default function CheckoutForm() {
  const { items, subtotal, alfajores, isOpen, close } = useCart();

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponState | null>(null);
  // Modalidad: 'shipping' (envío a domicilio, default) o 'pickup'
  // (retiro coordinado por WhatsApp).
  const [fulfillment, setFulfillment] = useState<'shipping' | 'pickup'>(
    'shipping'
  );
  // Método de pago: 'mercadopago' (default) o 'bank_transfer'.
  const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'bank_transfer'>(
    'mercadopago'
  );
  // Comprobante de transferencia (opcional). Lo guardamos como File para
  // poder mostrar el nombre antes de subirlo, y como receiptUrl con la URL
  // pública devuelta por /api/orders/bank-transfer/upload.
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // El total final descuenta el cupón (si lo hay) del subtotal del carrito
// y suma el envío fijo según la cantidad de alfajores.
  const shippingCost = useMemo(
    () => (fulfillment === 'pickup' ? 0 : calcShippingCost(alfajores)),
    [alfajores, fulfillment]
  );
  const finalTotal = useMemo(() => {
    const discount = appliedCoupon ? appliedCoupon.discount_total : 0;
    return Math.max(0, subtotal - discount + shippingCost);
  }, [subtotal, appliedCoupon, shippingCost]);

  // Pre-rellenar desde /api/me si hay sesión
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((r) => r.json())
      .then((data: { profile?: Profile }) => {
        if (cancelled) return;
        const p = data?.profile ?? null;
        if (p) {
          setFullName(p.full_name ?? '');
          setEmail(p.email ?? '');
          setPhone(p.phone ?? '');
          setAddress(p.address ?? '');
          setCity(p.city ?? '');
        }
        setProfileLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setProfileLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Si el drawer está abierto, lo cerramos al entrar al checkout.
  useEffect(() => {
    if (isOpen) close();
  }, [isOpen, close]);

  // Liberamos el object URL del preview cuando cambia o al desmontar.
  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  const summary = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: i.price,
        line: i.qty * i.price,
      })),
    [items]
  );

  const canSubmit =
    accepted && items.length > 0 && !submitting && !compressing && profileLoaded;

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.full_name = 'Ingresá tu nombre completo.';
    if (!email.trim()) next.email = 'Ingresá tu email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'El email no parece válido.';
    if (!phone.trim()) next.phone = 'Ingresá tu teléfono.';
    if (fulfillment === 'shipping') {
      if (!address.trim()) next.address = 'Ingresá la dirección de envío.';
      if (!city.trim()) next.city = 'Ingresá la ciudad o departamento.';
    }
    return next;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setMpError(null);
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      // Items enriquecidos: id, qty, name, price y currency. Para
      // transferencia los mandamos al server (no hay Preference de MP).
      // Para MP mandamos sólo id+qty porque el server resuelve el resto.
      const itemsToSend =
        paymentMethod === 'bank_transfer'
          ? items.map((i) => ({
              id: i.id,
              name: i.name,
              qty: i.qty,
              price: i.price,
              currency: i.currency,
            }))
          : items.map((i) => ({ id: i.id, qty: i.qty }));

      const body = {
        items: itemsToSend,
        customer_name: fullName.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        customer_address: fulfillment === 'shipping' ? address.trim() : '',
        customer_city: fulfillment === 'shipping' ? city.trim() : '',
        customer_notes: notes.trim() || null,
        coupon_code:
          appliedCoupon && appliedCoupon.discount_total > 0
            ? appliedCoupon.code
            : null,
        shipping_cost: shippingCost,
        shipping_currency: items[0]?.currency ?? 'UYU',
        fulfillment,
      };

      if (paymentMethod === 'bank_transfer') {
        let receiptUrl: string | null = null;
        if (receipt) {
          setUploadingReceipt(true);
          try {
            const fd = new FormData();
            fd.append('file', receipt);
            const upRes = await fetch('/api/orders/bank-transfer/upload', {
              method: 'POST',
              body: fd,
            });
            const upData: { ok?: boolean; url?: string; error?: string } =
              await upRes.json().catch(() => ({}));
            if (!upRes.ok || !upData?.ok || !upData?.url) {
              setMpError(
                upData?.error === 'too_large'
                  ? 'El comprobante supera los 5 MB.'
                  : upData?.error === 'unsupported_type'
                  ? 'Formato de comprobante no soportado. Subí JPG, PNG o PDF.'
                  : 'No pudimos subir el comprobante. Probá de nuevo o continuá sin él.'
              );
              setSubmitting(false);
              setUploadingReceipt(false);
              return;
            }
            receiptUrl = upData.url;
          } catch {
            setMpError('No pudimos subir el comprobante. Probá de nuevo.');
            setSubmitting(false);
            setUploadingReceipt(false);
            return;
          }
          setUploadingReceipt(false);
        }

        const res = await fetch('/api/orders/bank-transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, receipt_url: receiptUrl }),
        });
        const data: { ok?: boolean; order_id?: number; error?: string } =
          await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || !data?.order_id) {
          setMpError(
            data?.error
              ? `No pudimos registrar tu pedido (${data.error}). Probá de nuevo.`
              : 'No pudimos registrar tu pedido. Probá de nuevo.'
          );
          setSubmitting(false);
          return;
        }
        window.location.href = `/checkout/success?order_id=${data.order_id}`;
        return;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: { ok?: boolean; init_point?: string; error?: string } =
        await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.init_point) {
        setMpError(
          data?.error === 'mercadopago_not_configured'
            ? 'Mercado Pago no está configurado todavía. Probá Comprar por WhatsApp desde el carrito.'
            : 'No pudimos iniciar el pago. Probá de nuevo.'
        );
        setSubmitting(false);
        return;
      }
      window.location.href = data.init_point;
    } catch {
      setMpError('No pudimos iniciar el pago. Probá de nuevo.');
      setSubmitting(false);
    }
  };

  // Carrito vacío → CTA volver a la tienda
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-ink/15 bg-bone p-8 text-center">
        <p className="font-display text-2xl text-ink">Tu carrito está vacío</p>
        <p className="mt-2 font-body text-sm text-ink/70">
          Volvé a la tienda y sumá los alfajores que quieras.
        </p>
        <Link
          href="/#tienda"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon"
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {/* Resumen del pedido */}
      <div className="rounded-md border border-ink/15 bg-bone p-6">
        <p className="text-eyebrow text-gold-deep">Tu pedido</p>
        <ul className="mt-4 divide-y divide-ink/10">
          {summary.map((it) => (
            <li
              key={it.id}
              className="flex items-baseline justify-between gap-4 py-3 font-body text-sm"
            >
              <span className="text-ink">
                {it.qty} × {it.name}
              </span>
              <span className="whitespace-nowrap text-ink/85">
                {formatUY(it.line)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t border-ink/20 pt-4">
          <span className="text-eyebrow text-ink/70">Subtotal</span>
          <span className="font-display text-3xl text-gold">
            {formatUY(subtotal)}
          </span>
        </div>

        {appliedCoupon && appliedCoupon.discount_total > 0 && (
          <div className="mt-2 flex items-baseline justify-between font-body text-sm">
            <span className="text-green-800">
              Cupón {appliedCoupon.code}
            </span>
            <span className="text-green-800">
              −{formatUY(appliedCoupon.discount_total)}
            </span>
          </div>
        )}

        <div className="mt-2 flex items-baseline justify-between font-body text-sm">
          <span className="text-ink/80">
            {fulfillment === 'pickup'
              ? 'Retiro coordinado por WhatsApp'
              : `Envío (${alfajores} alfajor${alfajores === 1 ? '' : 'es'})`}
          </span>
          <span className="text-ink/80">
            {fulfillment === 'pickup'
              ? 'Gratis'
              : shippingCost > 0
              ? formatUY(shippingCost)
              : '—'}
          </span>
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t border-ink/10 pt-3">
          <span className="text-eyebrow text-ink/70">Total</span>
          <span className="font-display text-2xl text-ink">
            {formatUY(finalTotal)}
          </span>
        </div>

        <div className="mt-5">
          <CouponInput
            email={email}
            customerType={null}
            applied={appliedCoupon}
            onApplied={setAppliedCoupon}
          />
        </div>

        <p className="mt-3 font-body text-xs text-ink/55">
          {fulfillment === 'pickup'
            ? 'El retiro se coordina por WhatsApp después del pago.'
            : paymentMethod === 'bank_transfer'
            ? 'El envío se coordina al confirmar la transferencia.'
            : 'El envío se cobra junto con tu pedido en Mercado Pago.'}
        </p>
      </div>

      {/* Método de pago */}
      <div className="rounded-md border border-ink/15 bg-bone p-6">
        <p className="text-eyebrow text-gold-deep">Método de pago</p>
        <p className="mt-1 font-body text-xs text-ink/55">
          Elegí cómo querés pagar tu pedido.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PaymentOption
            value="mercadopago"
            current={paymentMethod}
            onSelect={setPaymentMethod}
            title="Mercado Pago"
            subtitle="Tarjeta, transferencia o saldo MP."
          />
          <PaymentOption
            value="bank_transfer"
            current={paymentMethod}
            onSelect={setPaymentMethod}
            title="Transferencia bancaria"
            subtitle="BBVA · te pasamos los datos para depositar."
          />
        </div>

        {paymentMethod === 'bank_transfer' && (
          <div className="mt-5 rounded-md border border-gold/30 bg-gold/10 p-5">
            <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
              Datos para la transferencia
            </p>
            <dl className="mt-3 grid gap-2 font-body text-sm text-ink sm:grid-cols-[auto_1fr]">
              <dt className="text-ink/70">Razón social</dt>
              <dd className="font-medium">Barlovento Uruguay SAS</dd>

              <dt className="text-ink/70">RUT</dt>
              <dd className="font-medium">220411340015</dd>

              <dt className="text-ink/70">Banco</dt>
              <dd className="font-medium">BBVA — Cuentas Corrientes</dd>

              <dt className="text-ink/70">Cuenta (UYU)</dt>
              <dd className="font-medium">26936976</dd>

              <dt className="text-ink/70">Cuenta (USD)</dt>
              <dd className="font-medium">26936976</dd>
            </dl>
            <p className="mt-4 font-body text-xs leading-relaxed text-ink/75">
              Una vez confirmado tu pedido, te enviaremos el comprobante por
              email y we'll acreditar el pago cuando lo veamos reflejado en la
              cuenta. Si tenés dudas, escribinos por WhatsApp.
            </p>

            <div className="mt-5">
              <ReceiptDropzone
                file={receipt}
                preview={receiptPreview}
                error={receiptError}
                uploading={uploadingReceipt}
                compressing={compressing}
                dragOver={dragOver}
                onFile={async (f) => {
                  setReceiptError(null);
                  const allowed = [
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'application/pdf',
                  ];
                  if (!allowed.includes(f.type)) {
                    setReceipt(null);
                    setReceiptPreview(null);
                    setReceiptError(
                      'Formato no soportado. Subí una imagen (JPG, PNG, WebP) o un PDF.'
                    );
                    return;
                  }

                  // PDFs: pasan tal cual (límite server-side 5 MB).
                  if (f.type === 'application/pdf') {
                    if (f.size > 5 * 1024 * 1024) {
                      setReceipt(null);
                      setReceiptPreview(null);
                      setReceiptError('El PDF supera los 5 MB. Probá con uno más liviano.');
                      return;
                    }
                    setReceipt(f);
                    setReceiptPreview(null);
                    return;
                  }

                  // Imágenes: cortamos primero a 15 MB para no bloquear el
                  // navegador con fotos absurdas, después comprimimos.
                  if (f.size > 15 * 1024 * 1024) {
                    setReceipt(null);
                    setReceiptPreview(null);
                    setReceiptError('La imagen es muy pesada (>15 MB). Sacale una foto más chica.');
                    return;
                  }

                  setCompressing(true);
                  try {
                    const result = await compressImage(f, {
                      maxWidth: 2000,
                      maxHeight: 2000,
                      quality: 0.8,
                      mimeType: 'image/webp',
                    });

                    if (result.file.size > 5 * 1024 * 1024) {
                      setReceipt(null);
                      setReceiptPreview(null);
                      setReceiptError(
                        'No pudimos reducir la imagen lo suficiente. Probá con una foto más chica.'
                      );
                      return;
                    }

                    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
                    setReceipt(result.file);
                    const url = URL.createObjectURL(result.file);
                    setReceiptPreview(url);
                  } catch (err) {
                    setReceipt(null);
                    setReceiptPreview(null);
                    setReceiptError(
                      err instanceof Error
                        ? err.message
                        : 'No pudimos procesar la imagen.'
                    );
                  } finally {
                    setCompressing(false);
                  }
                }}
                onClear={() => {
                  if (receiptPreview) URL.revokeObjectURL(receiptPreview);
                  setReceipt(null);
                  setReceiptPreview(null);
                  setReceiptError(null);
                }}
                onError={setReceiptError}
                onDragChange={setDragOver}
              />
              <p className="mt-2 font-body text-xs text-ink/55">
                Opcional. Si ya hiciste la transferencia, subí una foto o captura
                del comprobante (JPG, PNG, WebP) o el PDF del home banking.
                Máximo 5 MB.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modalidad de entrega */}
      <div className="rounded-md border border-ink/15 bg-bone p-6">
        <p className="text-eyebrow text-gold-deep">Modalidad de entrega</p>
        <p className="mt-1 font-body text-xs text-ink/55">
          Elegí cómo querés recibir tu pedido.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FulfillmentOption
            value="shipping"
            current={fulfillment}
            onSelect={setFulfillment}
            title="Envío a domicilio"
            subtitle="Te lo mandamos a cualquier punto del país."
          />
          <FulfillmentOption
            value="pickup"
            current={fulfillment}
            onSelect={setFulfillment}
            title="Retiro coordinado por WhatsApp"
            subtitle="Pagás online y coordinás día/hora por WhatsApp."
          />
        </div>
      </div>

      {/* Datos de contacto y envío */}
      <div className="rounded-md border border-ink/15 bg-bone p-6">
        <p className="text-eyebrow text-gold-deep">
          {fulfillment === 'pickup' ? 'Datos de contacto' : 'Datos de envío'}
        </p>
        <p className="mt-1 font-body text-xs text-ink/55">
          {fulfillment === 'pickup'
            ? 'Necesitamos tu nombre, email y teléfono para coordinar el retiro por WhatsApp.'
            : 'Si tenés una cuenta, completamos estos campos con tus datos. Podés modificarlos antes de pagar.'}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            id="full_name"
            label="Nombre completo"
            value={fullName}
            onChange={setFullName}
            error={errors.full_name}
            autoComplete="name"
            required
          />
          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            error={errors.email}
            autoComplete="email"
            required
          />
          <Field
            id="phone"
            label="Teléfono"
            value={phone}
            onChange={setPhone}
            error={errors.phone}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+598…"
            required
          />
          {fulfillment === 'shipping' && (
            <>
              <Field
                id="city"
                label="Ciudad o departamento"
                value={city}
                onChange={setCity}
                error={errors.city}
                autoComplete="address-level2"
                required
              />
              <div className="sm:col-span-2">
                <Field
                  id="address"
                  label="Dirección de envío"
                  value={address}
                  onChange={setAddress}
                  error={errors.address}
                  autoComplete="street-address"
                  placeholder="Calle, número, apartamento"
                  required
                />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label
              htmlFor="notes"
              className="block font-body text-xs uppercase tracking-ultra text-ink/70"
            >
              Notas
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={
                fulfillment === 'pickup'
                  ? 'Preferencias de día u horario para retirar (opcional)'
                  : 'Indicaciones para la entrega (opcional)'
              }
              className="mt-2 w-full rounded-md border border-ink/20 bg-cream px-4 py-3 font-body text-base text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
        </div>
      </div>

      {/* Aclaración según modalidad */}
      <div className="rounded-md border border-gold/30 bg-gold/10 p-5">
        <p className="font-body text-[10px] uppercase tracking-ultra text-gold-deep">
          {fulfillment === 'pickup' ? 'Cómo funciona el retiro' : 'Política de envío'}
        </p>
        {fulfillment === 'pickup' ? (
          <>
            <p className="mt-2 font-body text-base leading-relaxed text-ink">
              Retirá tu pedido en <strong>Trinidad</strong> o coordiná la entrega
              en <strong>Montevideo</strong>.
            </p>
            <ul className="mt-3 space-y-2 font-body text-sm text-ink">
              <li className="flex gap-2">
                <span aria-hidden className="font-body text-gold-deep">📍</span>
                <span>
                  <strong>Trinidad:</strong> podés retirar tu pedido coordinando
                  previamente.
                </span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="font-body text-gold-deep">📦</span>
                <span>
                  <strong>Montevideo:</strong> viajamos aproximadamente cada 15
                  días. Si estás en Montevideo, coordinamos la entrega de tu
                  pedido con anticipación.
                </span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="font-body text-gold-deep">✨</span>
                <span>
                  ¿No sabés cuándo viajamos? Escribinos y te informamos la
                  próxima fecha disponible.
                </span>
              </li>
            </ul>
          </>
        ) : (
          <>
            <p className="mt-2 font-body text-base leading-relaxed text-ink">
              El envío va a ser:
            </p>
            <ul className="mt-2 space-y-1 font-body text-base text-ink">
              <li>
                <strong>Hasta 20 alfajores:</strong> $195
              </li>
              <li>
                <strong>Más de 20 alfajores:</strong> $220
              </li>
            </ul>
            <p className="mt-2 font-body text-sm text-ink/80">
              A cualquier lugar del país. Se cobra junto con tu pedido en Mercado
              Pago.
            </p>
          </>
        )}
      </div>

      {/* Checkbox de aceptación */}
      <div className="rounded-md border border-ink/15 bg-bone p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            aria-required="true"
            className="mt-1 h-5 w-5 shrink-0 rounded border-ink/40 text-ink focus:ring-2 focus:ring-gold"
          />
          <span className="font-body text-sm leading-relaxed text-ink">
            {fulfillment === 'pickup'
              ? 'Entiendo que el retiro se coordina por WhatsApp después del pago y confirmo que los datos de contacto son correctos.'
              : 'Entiendo que el envío tiene un costo fijo de $195 o $220 según la cantidad de alfajores y se cobra junto con el pedido. Confirmo que los datos ingresados son correctos.'}
          </span>
        </label>
      </div>

      {mpError && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          {mpError}
        </p>
      )}

      <GoldDivider />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/#tienda"
          className="font-body text-xs uppercase tracking-ultra text-ink/60 hover:text-ink"
        >
          ← Seguir comprando
        </Link>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          className="rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? paymentMethod === 'bank_transfer'
              ? uploadingReceipt
                ? 'Subiendo comprobante…'
                : 'Registrando tu pedido…'
              : 'Conectando con Mercado Pago…'
            : compressing
            ? 'Optimizando imagen…'
            : paymentMethod === 'bank_transfer'
            ? 'Confirmar pedido por transferencia'
            : 'Pagar con Mercado Pago'}
        </button>
      </div>

      {!accepted && items.length > 0 && (
        <p className="text-center font-body text-xs text-ink/55">
          Marcá la casilla para habilitar el pago.
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  error,
  required,
  autoComplete,
  inputMode,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  placeholder?: string;
}) {
  const hasError = !!error;
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-body text-xs uppercase tracking-ultra text-ink/70"
      >
        {label}
        {required && <span className="ml-1 text-gold-deep">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={hasError || undefined}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        className={[
          'mt-2 block w-full rounded-md border bg-cream px-4 py-3 font-body text-base text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2',
          hasError
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-ink/20 focus:border-ink focus:ring-gold/40',
        ].join(' ')}
      />
      {hasError && (
        <p className="mt-1 font-body text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

function PaymentOption({
  value,
  current,
  onSelect,
  title,
  subtitle,
}: {
  value: 'mercadopago' | 'bank_transfer';
  current: 'mercadopago' | 'bank_transfer';
  onSelect: (v: 'mercadopago' | 'bank_transfer') => void;
  title: string;
  subtitle: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={[
        'text-left rounded-md border px-4 py-4 transition focus:outline-none focus:ring-2 focus:ring-gold/40',
        active
          ? 'border-gold bg-gold/10'
          : 'border-ink/20 bg-cream hover:border-ink/40',
      ].join(' ')}
    >
      <span className="flex items-center gap-2 font-body text-xs uppercase tracking-ultra text-gold-deep">
        <span
          aria-hidden
          className={[
            'inline-flex h-3 w-3 rounded-full border',
            active ? 'border-gold bg-gold' : 'border-ink/40 bg-transparent',
          ].join(' ')}
        />
        {title}
      </span>
      <span className="mt-2 block font-body text-sm text-ink/80">{subtitle}</span>
    </button>
  );
}

function FulfillmentOption({
  value,
  current,
  onSelect,
  title,
  subtitle,
}: {
  value: 'shipping' | 'pickup';
  current: 'shipping' | 'pickup';
  onSelect: (v: 'shipping' | 'pickup') => void;
  title: string;
  subtitle: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={[
        'text-left rounded-md border px-4 py-4 transition focus:outline-none focus:ring-2 focus:ring-gold/40',
        active
          ? 'border-gold bg-gold/10'
          : 'border-ink/20 bg-cream hover:border-ink/40',
      ].join(' ')}
    >
      <span className="flex items-center gap-2 font-body text-xs uppercase tracking-ultra text-gold-deep">
        <span
          aria-hidden
          className={[
            'inline-flex h-3 w-3 rounded-full border',
            active ? 'border-gold bg-gold' : 'border-ink/40 bg-transparent',
          ].join(' ')}
        />
        {title}
      </span>
      <span className="mt-2 block font-body text-sm text-ink/80">{subtitle}</span>
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ReceiptDropzone({
  file,
  preview,
  error,
  uploading,
  compressing,
  dragOver,
  onFile,
  onClear,
  onError,
  onDragChange,
}: {
  file: File | null;
  preview: string | null;
  error: string | null;
  uploading: boolean;
  compressing: boolean;
  dragOver: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
  onError: (msg: string | null) => void;
  onDragChange: (v: boolean) => void;
}) {
  const inputId = 'receipt-input';

  // ───────── Empty state: card elevada con drop zone ─────────
  if (!file) {
    return (
      <div>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            onDragChange(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            onDragChange(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            onDragChange(false);
            const f = e.dataTransfer.files?.[0];
            if (f) {
              onError(null);
              onFile(f);
            }
          }}
          className={[
            // Layout: columna centrada, padding generoso, esquinas 14px
            'group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[14px] px-6 py-10 text-center',
            // Surface: sombra multicapa Soft UI sobre cream
            'border bg-bone shadow-[0_1px_2px_rgba(28,28,28,0.04),0_8px_24px_-8px_rgba(28,28,28,0.10)]',
            'transition-all duration-200 ease-out motion-reduce:transition-none',
            // Hover: lift + ring dorado
            'hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(28,28,28,0.05),0_16px_32px_-10px_rgba(184,134,51,0.25)]',
            // Focus: anillo dorado 3px
            'focus-within:outline-none focus-within:ring-[3px] focus-within:ring-gold/40 focus-within:ring-offset-2 focus-within:ring-offset-cream',
            // Estados de borde
            dragOver
              ? 'border-gold ring-[3px] ring-gold/30 ring-offset-2 ring-offset-cream'
              : error
              ? 'border-red-300 bg-red-50/30 hover:border-red-400'
              : 'border-ink/15 hover:border-gold/50',
          ].join(' ')}
        >
          {/* Ícono: círculo con gradiente dorado y cloud-up SVG */}
          <span
            aria-hidden
            className={[
              'grid h-14 w-14 place-items-center rounded-full',
              'bg-gradient-to-br from-gold/25 via-gold/10 to-transparent',
              'text-gold-deep',
              'ring-1 ring-gold/20',
              'transition-transform duration-200 ease-out group-hover:scale-105 group-hover:ring-gold/40 motion-reduce:transition-none motion-reduce:group-hover:scale-100',
              dragOver ? 'scale-110 ring-gold/50' : '',
            ].join(' ')}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </span>

          {/* Texto principal */}
          <span className="font-display text-lg leading-tight text-ink">
            {dragOver
              ? 'Soltá el archivo acá'
              : 'Subí tu comprobante'}
          </span>
          <span className="font-body text-sm text-ink/60">
            {dragOver
              ? 'Ya casi está…'
              : 'Arrastrá una foto o PDF, o hacé click para elegir'}
          </span>

          {/* Chips de tipos aceptados */}
          <span className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
            {['JPG', 'PNG', 'WebP', 'PDF'].map((t) => (
              <span
                key={t}
                className="rounded-full border border-ink/15 bg-cream/80 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-ultra text-ink/60"
              >
                {t}
              </span>
            ))}
            <span className="rounded-full border border-ink/15 bg-cream/80 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-ultra text-ink/60">
              máx. 5 MB
            </span>
          </span>

          {/* CTA secundario */}
          <span
            aria-hidden
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 font-body text-[10px] uppercase tracking-ultra text-cream transition-colors group-hover:bg-gold-deep group-hover:text-carbon"
          >
            Elegir archivo
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>

          <input
            id={inputId}
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onError(null);
                onFile(f);
              }
              e.target.value = '';
            }}
            className="sr-only"
          />
        </label>

        {/* Error inline accesible */}
        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50/80 px-3 py-2 font-body text-xs text-red-700 shadow-[0_1px_2px_rgba(220,38,38,0.06)]"
          >
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // ───────── Filled state: card elevada con thumbnail + meta + acciones ─────────
  const isImage = file.type.startsWith('image/');
  return (
    <div>
      <div
        aria-live="polite"
        className={[
          'relative flex items-stretch gap-4 overflow-hidden rounded-[14px] border bg-bone p-4',
          'shadow-[0_1px_2px_rgba(28,28,28,0.04),0_8px_24px_-8px_rgba(28,28,28,0.10)]',
          'transition-all duration-200 ease-out',
          uploading ? 'border-gold/50' : 'border-emerald-500/30',
        ].join(' ')}
      >
        {/* Barra de progreso shimmer durante upload */}
        {uploading && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
          >
            <span className="block h-full w-1/3 animate-shimmer-slide bg-gradient-to-r from-transparent via-gold to-transparent" />
          </span>
        )}

        {/* Thumbnail */}
        <div className="relative shrink-0">
          {isImage && preview ? (
            <img
              src={preview}
              alt="Vista previa del comprobante"
              className="h-20 w-20 rounded-[10px] border border-ink/10 object-cover shadow-[0_2px_8px_rgba(28,28,28,0.08)]"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-20 w-20 place-items-center rounded-[10px] border border-ink/10 bg-gradient-to-br from-cream to-bone text-gold-deep shadow-[0_2px_8px_rgba(28,28,28,0.08)]"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
          )}
          {/* Status dot overlay */}
          <span
            aria-hidden
            className={[
              'absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-bone shadow-sm',
              uploading || compressing ? 'bg-gold' : 'bg-emerald-500',
            ].join(' ')}
          >
            {uploading || compressing ? (
              <span className="block h-2 w-2 animate-pulse rounded-full bg-cream" />
            ) : (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-cream"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
        </div>

        {/* Meta */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p
            className="truncate font-body text-sm font-semibold text-ink"
            title={file.name}
          >
            {file.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-body text-xs text-ink/55">
            <span>{formatBytes(file.size)}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-ink/30" />
            <span>
              {isImage ? 'Imagen' : file.type === 'application/pdf' ? 'PDF' : file.type}
            </span>
          </div>
          <p
            className={[
              'mt-1.5 inline-flex items-center gap-1.5 font-body text-xs font-medium',
              uploading || compressing ? 'text-gold-deep' : 'text-emerald-700',
            ].join(' ')}
          >
            {compressing ? (
              <>
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold-deep"
                />
                Optimizando imagen…
              </>
            ) : uploading ? (
              <>
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold-deep"
                />
                Subiendo comprobante…
              </>
            ) : (
              <>
                <span aria-hidden>✓</span>
                Listo para enviar con tu pedido
              </>
            )}
          </p>
        </div>

        {/* Acciones: icon buttons con touch target ≥44px */}
        <div className="flex shrink-0 items-center gap-1.5">
          <label
            htmlFor={inputId + '-replace'}
            title="Cambiar archivo"
            aria-label="Cambiar archivo"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-ink/15 bg-cream text-ink/70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gold/60 hover:bg-gold/10 hover:text-gold-deep hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <input
              id={inputId + '-replace'}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  onError(null);
                  onFile(f);
                }
                e.target.value = '';
              }}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={onClear}
            title="Quitar archivo"
            aria-label="Quitar archivo"
            className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-cream text-ink/60 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50/80 px-3 py-2 font-body text-xs text-red-700 shadow-[0_1px_2px_rgba(220,38,38,0.06)]"
        >
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
