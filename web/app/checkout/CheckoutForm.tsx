'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartContext';
import GoldDivider from '@/components/GoldDivider';
import CouponInput, { type AppliedCouponState } from '@/components/CouponInput';
import { formatMoney } from '@/components/formatMoney';

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
    accepted && items.length > 0 && !submitting && profileLoaded;

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
      // Items crudos: sólo id y qty van al server. El server resuelve
      // nombre, precio y currency desde la DB.
      const itemsToSend = items.map((i) => ({
        id: i.id,
        qty: i.qty,
      }));

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
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
            : 'El envío se cobra junto con tu pedido en Mercado Pago.'}
        </p>
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
              Pagás online con Mercado Pago y, apenas el pago se confirme, te
              mostramos un botón para escribirnos por WhatsApp y coordinar el
              retiro.
            </p>
            <p className="mt-2 font-body text-sm text-ink/80">
              No cobramos envío. Coordinás día, hora y lugar con la marca.
            </p>
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
          {submitting ? 'Conectando con Mercado Pago…' : 'Pagar con Mercado Pago'}
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
