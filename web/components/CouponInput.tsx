'use client';

import { useState } from 'react';
import { useCart } from '@/components/CartContext';

export type AppliedCouponState = {
  code: string;
  coupon_id: string;
  discount_total: number;
  shipping_discount: number;
  lines: Array<{
    rule_id: string;
    kind: string;
    description: string;
    amount: number;
    free_shipping: boolean;
  }>;
};

type Props = {
  email?: string | null;
  customerType?: 'retail' | 'wholesale' | null;
  onApplied: (coupon: AppliedCouponState | null) => void;
  applied: AppliedCouponState | null;
};

export default function CouponInput({ email, customerType, onApplied, applied }: Props) {
  const { items } = useCart();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function apply() {
    if (!code.trim()) return;
    setStatus('loading');
    setMessage(null);

    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: code.trim(),
        cart: items.map((i) => ({
          id: i.id,
          name: i.name,
          category: '',        // el CartContext no persiste categoría; el backend la ignora si la rule no filtra por categoría
          qty: i.qty,
          price: i.price,
          currency: i.currency,
        })),
        customer: {
          email: email ?? null,
          customer_type: customerType ?? null,
        },
        shipping_cost: 0,        // envío se coordina aparte; los cupones de envío se aplican a futuro
      }),
    });

    const data = await res.json().catch(() => null);
    if (data?.ok) {
      setStatus('success');
      setMessage(null);
      onApplied({
        code: data.code,
        coupon_id: data.coupon_id,
        discount_total: data.discount_total,
        shipping_discount: data.shipping_discount,
        lines: data.lines,
      });
      setCode('');
    } else {
      setStatus('error');
      setMessage(data?.message ?? 'No pudimos validar el cupón.');
      onApplied(null);
    }
  }

  function remove() {
    onApplied(null);
    setStatus('idle');
    setMessage(null);
  }

  if (applied) {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-body text-xs uppercase tracking-ultra text-green-800">
              Cupón aplicado
            </p>
            <p className="mt-1 font-display text-lg text-green-900">{applied.code}</p>
            {applied.lines.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {applied.lines.map((l, i) => (
                  <li key={i} className="font-body text-xs text-green-800">
                    {l.description}
                    {l.amount > 0 && ` (−$${l.amount.toFixed(0)})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={remove}
            className="font-body text-xs uppercase tracking-ultra text-green-800 hover:text-green-950"
          >
            Quitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ink/15 bg-bone p-4">
      <p className="font-body text-xs uppercase tracking-ultra text-ink/70">
        ¿Tenés un cupón?
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="VERANO20"
          disabled={status === 'loading'}
          className="flex-1 rounded-md border border-ink/20 bg-cream px-3 py-2 font-mono text-sm uppercase text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold/40"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
        />
        <button
          type="button"
          onClick={apply}
          disabled={!code.trim() || status === 'loading'}
          className="rounded-md bg-ink px-4 py-2 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? 'Validando…' : 'Aplicar'}
        </button>
      </div>
      {status === 'error' && message && (
        <p className="mt-2 font-body text-xs text-red-700">{message}</p>
      )}
      {status === 'success' && (
        <p className="mt-2 font-body text-xs text-green-800">Cupón aplicado correctamente.</p>
      )}
    </div>
  );
}
