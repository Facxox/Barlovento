'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Coupon, CouponRule } from '@/lib/coupons';

type Props = { initialCoupons: Coupon[] };

type RuleDraft = {
  kind: CouponRule['kind'];
  value: number | null;
  config: Record<string, unknown>;
  applies_to: { all?: boolean; product_ids?: string[]; categories?: string[] };
};

const RULE_KINDS: CouponRule['kind'][] = ['percent', 'fixed', 'free_shipping', 'bxgy', 'gift_product'];

const blankRule = (): RuleDraft => ({
  kind: 'percent',
  value: 10,
  config: {},
  applies_to: { all: true },
});

export default function CouponsAdmin({ initialCoupons }: Props) {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // form state
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('');
  const [combinable, setCombinable] = useState(false);
  const [customerType, setCustomerType] = useState<'' | 'retail' | 'wholesale'>('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [rules, setRules] = useState<RuleDraft[]>([blankRule()]);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        description: description || null,
        is_active: true,
        min_subtotal: minSubtotal ? Number(minSubtotal) : null,
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        per_user_limit: perUserLimit ? Number(perUserLimit) : null,
        combinable,
        customer_type: customerType || null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        rules: rules.map((r, i) => ({
          kind: r.kind,
          value: r.value,
          config: r.config,
          applies_to: r.applies_to,
          sort_order: i,
        })),
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? 'Error al crear el cupón');
      return;
    }
    setShowForm(false);
    setCode(''); setDescription(''); setMinSubtotal(''); setMaxDiscount('');
    setUsageLimit(''); setPerUserLimit(''); setCombinable(false);
    setCustomerType(''); setStartsAt(''); setEndsAt('');
    setRules([blankRule()]);
    startTransition(() => router.refresh());
  }

  async function toggleActive(c: Coupon) {
    const res = await fetch('/api/admin/coupons', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
    });
    if (res.ok) {
      setCoupons((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x))
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este cupón? Sus redenciones históricas se conservan.')) return;
    const res = await fetch(`/api/admin/coupons?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCoupons((prev) => prev.filter((x) => x.id !== id));
    }
  }

  function updateRule(idx: number, patch: Partial<RuleDraft>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateRuleConfig(idx: number, key: string, value: unknown) {
    setRules((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, config: { ...r.config, [key]: value } } : r
      )
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Cupones y promociones</h2>
          <p className="text-sm text-ink/60 mt-1">
            {coupons.length} cupón{coupons.length === 1 ? '' : 'es'} configurado{coupons.length === 1 ? '' : 's'}.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-gold-deep text-cream rounded-md text-sm font-medium hover:bg-gold transition-colors"
        >
          {showForm ? 'Cancelar' : 'Nuevo cupón'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-ink/10 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Código">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VERANO20"
                className="input"
              />
            </Field>
            <Field label="Descripción">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="20% off en vinos"
                className="input"
              />
            </Field>
            <Field label="Mínimo de compra">
              <input type="number" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} className="input" />
            </Field>
            <Field label="Tope de descuento">
              <input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} className="input" />
            </Field>
            <Field label="Límite de usos global">
              <input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} className="input" />
            </Field>
            <Field label="Límite por usuario">
              <input type="number" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} className="input" />
            </Field>
            <Field label="Inicio">
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input" />
            </Field>
            <Field label="Fin">
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input" />
            </Field>
            <Field label="Tipo de cliente">
              <select value={customerType} onChange={(e) => setCustomerType(e.target.value as any)} className="input">
                <option value="">Todos</option>
                <option value="retail">Solo minorista</option>
                <option value="wholesale">Solo mayorista</option>
              </select>
            </Field>
            <Field label="Combinable">
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={combinable} onChange={(e) => setCombinable(e.target.checked)} />
                <span className="text-sm">Permite combinarse con otros cupones</span>
              </label>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-ink">Reglas del cupón</h3>
              <button
                onClick={() => setRules((prev) => [...prev, blankRule()])}
                className="text-sm text-gold-deep hover:underline"
              >
                + Agregar regla
              </button>
            </div>
            <div className="space-y-3">
              {rules.map((r, i) => (
                <div key={i} className="border border-ink/10 rounded-md p-4 bg-cream/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Tipo">
                      <select
                        value={r.kind}
                        onChange={(e) => updateRule(i, { kind: e.target.value as CouponRule['kind'] })}
                        className="input"
                      >
                        {RULE_KINDS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Valor">
                      <input
                        type="number"
                        value={r.value ?? ''}
                        onChange={(e) => updateRule(i, { value: e.target.value === '' ? null : Number(e.target.value) })}
                        className="input"
                        disabled={r.kind === 'free_shipping' || r.kind === 'gift_product'}
                      />
                    </Field>
                    <Field label="Aplica a">
                      <select
                        value={r.applies_to.all ? 'all' : 'cats'}
                        onChange={(e) => updateRule(i, {
                          applies_to: e.target.value === 'all'
                            ? { all: true }
                            : { categories: [] },
                        })}
                        className="input"
                      >
                        <option value="all">Todo el carrito</option>
                        <option value="cats">Por categoría</option>
                      </select>
                    </Field>
                  </div>

                  {/* Inputs específicos por kind */}
                  {r.kind === 'bxgy' && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <Field label="Comprá (qty)">
                        <input
                          type="number" min={1}
                          value={(r.config as any).buy_qty ?? ''}
                          onChange={(e) => updateRuleConfig(i, 'buy_qty', Number(e.target.value))}
                          className="input"
                        />
                      </Field>
                      <Field label="Llevás (qty gratis)">
                        <input
                          type="number" min={1}
                          value={(r.config as any).get_qty ?? ''}
                          onChange={(e) => updateRuleConfig(i, 'get_qty', Number(e.target.value))}
                          className="input"
                        />
                      </Field>
                      <Field label="% descuento en el gratis">
                        <input
                          type="number" min={0} max={100}
                          value={(r.config as any).get_discount_pct ?? 100}
                          onChange={(e) => updateRuleConfig(i, 'get_discount_pct', Number(e.target.value))}
                          className="input"
                        />
                      </Field>
                    </div>
                  )}

                  {r.kind === 'gift_product' && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="ID producto regalo">
                        <input
                          value={(r.config as any).gift_product_id ?? ''}
                          onChange={(e) => updateRuleConfig(i, 'gift_product_id', e.target.value)}
                          className="input"
                          placeholder="alfajor-chocolate"
                        />
                      </Field>
                      <Field label="Cantidad">
                        <input
                          type="number" min={1}
                          value={(r.config as any).gift_qty ?? 1}
                          onChange={(e) => updateRuleConfig(i, 'gift_qty', Number(e.target.value))}
                          className="input"
                        />
                      </Field>
                    </div>
                  )}
                  <button
                    onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
                    className="text-xs text-red-700 mt-2 hover:underline"
                  >
                    Quitar regla
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-ink/70 hover:text-ink"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!code || isPending}
              className="px-4 py-2 bg-ink text-cream rounded-md text-sm disabled:opacity-50"
            >
              Crear cupón
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-ink/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-ink/70">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Código</th>
              <th className="text-left px-4 py-3 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 font-medium">Reglas</th>
              <th className="text-left px-4 py-3 font-medium">Usos</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-ink/5">
                <td className="px-4 py-3 font-mono">{c.code}</td>
                <td className="px-4 py-3">
                  {c.customer_type ?? 'ambos'} · {c.combinable ? 'combinable' : 'exclusivo'}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {c.rules.length} regla{c.rules.length === 1 ? '' : 's'}
                </td>
                <td className="px-4 py-3">
                  {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-ink/10 text-ink/60'}`}>
                    {c.is_active ? 'activo' : 'inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => toggleActive(c)} className="text-xs text-gold-deep hover:underline">
                    {c.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-red-700 hover:underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                  No hay cupones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 0.375rem;
          background: white;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #b89358;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink/70 mb-1">{label}</span>
      {children}
    </label>
  );
}
