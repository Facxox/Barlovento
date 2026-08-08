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

// Estilos compartidos (carbon theme)
const inputBase =
  'w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none';
const selectBase = inputBase + ' [&>option]:bg-carbon';
const labelEyebrow =
  'mb-1 block font-body text-[10px] uppercase tracking-ultra text-bone/50';

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
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-bone">Cupones</h1>
        <p className="mt-1 font-body text-sm text-bone/60">
          {coupons.length} cupón{coupons.length === 1 ? '' : 'es'} configurado{coupons.length === 1 ? '' : 's'}.
        </p>
      </header>

      <div className="mb-10 flex items-center justify-between border border-carbon-line bg-carbon p-4 sm:p-6">
        <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
          {showForm ? 'Nuevo cupón' : 'Promociones'}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-gold px-6 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          {showForm ? 'Cancelar' : 'Nuevo cupón'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="mb-10 space-y-6 border border-carbon-line bg-carbon p-4 sm:p-6"
        >
          <div>
            <p className="mb-4 font-body text-[10px] uppercase tracking-ultra text-gold">
              Datos básicos
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Código">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VERANO20"
                  required
                  className={inputBase + ' font-mono'}
                />
              </Field>
              <Field label="Descripción">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="20% off en vinos"
                  className={inputBase}
                />
              </Field>
              <Field label="Mínimo de compra">
                <input
                  type="number"
                  value={minSubtotal}
                  onChange={(e) => setMinSubtotal(e.target.value)}
                  className={inputBase}
                />
              </Field>
              <Field label="Tope de descuento">
                <input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  className={inputBase}
                />
              </Field>
              <Field label="Límite de usos global">
                <input
                  type="number"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  className={inputBase}
                />
              </Field>
              <Field label="Límite por usuario">
                <input
                  type="number"
                  value={perUserLimit}
                  onChange={(e) => setPerUserLimit(e.target.value)}
                  className={inputBase}
                />
              </Field>
              <Field label="Inicio">
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className={inputBase}
                />
              </Field>
              <Field label="Fin">
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className={inputBase}
                />
              </Field>
              <Field label="Tipo de cliente">
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as '' | 'retail' | 'wholesale')}
                  className={selectBase}
                >
                  <option value="">Todos</option>
                  <option value="retail">Solo minorista</option>
                  <option value="wholesale">Solo mayorista</option>
                </select>
              </Field>
              <Field label="Combinable">
                <label className="mt-2 flex items-center gap-2 font-body text-sm text-bone/80">
                  <input
                    type="checkbox"
                    checked={combinable}
                    onChange={(e) => setCombinable(e.target.checked)}
                    className="h-4 w-4 accent-gold"
                  />
                  Permite combinarse con otros cupones
                </label>
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
                Reglas del cupón
              </p>
              <button
                type="button"
                onClick={() => setRules((prev) => [...prev, blankRule()])}
                className="font-body text-[10px] uppercase tracking-ultra text-gold hover:underline"
              >
                + Agregar regla
              </button>
            </div>
            <div className="space-y-4">
              {rules.map((r, i) => (
                <div
                  key={i}
                  className="border border-carbon-line bg-carbon-raised p-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Tipo">
                      <select
                        value={r.kind}
                        onChange={(e) => updateRule(i, { kind: e.target.value as CouponRule['kind'] })}
                        className={selectBase}
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
                        className={inputBase}
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
                        className={selectBase}
                      >
                        <option value="all">Todo el carrito</option>
                        <option value="cats">Por categoría</option>
                      </select>
                    </Field>
                  </div>

                  {r.kind === 'bxgy' && (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Field label="Comprá (qty)">
                        <input
                          type="number" min={1}
                          value={(r.config as any).buy_qty ?? ''}
                          onChange={(e) => updateRuleConfig(i, 'buy_qty', Number(e.target.value))}
                          className={inputBase}
                        />
                      </Field>
                      <Field label="Llevás (qty gratis)">
                        <input
                          type="number" min={1}
                          value={(r.config as any).get_qty ?? ''}
                          onChange={(e) => updateRuleConfig(i, 'get_qty', Number(e.target.value))}
                          className={inputBase}
                        />
                      </Field>
                      <Field label="% descuento en el gratis">
                        <input
                          type="number" min={0} max={100}
                          value={(r.config as any).get_discount_pct ?? 100}
                          onChange={(e) => updateRuleConfig(i, 'get_discount_pct', Number(e.target.value))}
                          className={inputBase}
                        />
                      </Field>
                    </div>
                  )}

                  {r.kind === 'gift_product' && (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="ID producto regalo">
                        <input
                          value={(r.config as any).gift_product_id ?? ''}
                          onChange={(e) => updateRuleConfig(i, 'gift_product_id', e.target.value)}
                          className={inputBase}
                          placeholder="alfajor-chocolate"
                        />
                      </Field>
                      <Field label="Cantidad">
                        <input
                          type="number" min={1}
                          value={(r.config as any).gift_qty ?? 1}
                          onChange={(e) => updateRuleConfig(i, 'gift_qty', Number(e.target.value))}
                          className={inputBase}
                        />
                      </Field>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
                    className="mt-3 font-body text-[10px] uppercase tracking-ultra text-red-400 hover:text-red-300"
                  >
                    Quitar regla
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!code || isPending}
              className="rounded-full bg-gold px-6 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
            >
              Crear cupón
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="p-4">Código</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Reglas</th>
              <th className="p-4">Usos</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-carbon-line/40 font-body text-sm">
                <td className="p-4 font-mono text-bone">{c.code}</td>
                <td className="p-4 text-bone/80">
                  {c.customer_type ?? 'ambos'} · {c.combinable ? 'combinable' : 'exclusivo'}
                </td>
                <td className="p-4 text-bone/60">
                  {c.rules.length} regla{c.rules.length === 1 ? '' : 's'}
                </td>
                <td className="p-4 text-bone/80">
                  {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                </td>
                <td className="p-4">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                      c.is_active
                        ? 'bg-gold/20 text-gold'
                        : 'bg-carbon-line text-bone/50',
                    ].join(' ')}
                  >
                    {c.is_active ? 'activo' : 'inactivo'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className="rounded-full border border-gold/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-gold transition hover:bg-gold hover:text-carbon"
                    >
                      {c.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="rounded-full border border-red-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-red-400 transition hover:bg-red-500/20"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center font-body text-sm text-bone/50">
                  No hay cupones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelEyebrow}>{label}</span>
      {children}
    </label>
  );
}