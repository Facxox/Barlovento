'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Coupon, CouponRule } from '@/lib/coupons';
import type { Product } from '@/lib/queries';

// Producto que se muestra en el picker: igual a Product + etiqueta
// de audiencia para saber si el producto aplica a retail, mayorista
// o ambos.
export type PickerProduct = Product & {
  audience: 'retail' | 'wholesale' | 'both';
};

const AUDIENCE_LABEL: Record<PickerProduct['audience'], string> = {
  retail: 'Minorista',
  wholesale: 'Mayorista',
  both: 'Minorista y mayorista',
};

const AUDIENCE_STYLES: Record<PickerProduct['audience'], string> = {
  retail: 'bg-blue-500/20 text-blue-300',
  wholesale: 'bg-purple-500/20 text-purple-300',
  both: 'bg-gold/20 text-gold',
};

type Props = { initialCoupons: Coupon[]; products: PickerProduct[] };

type RuleDraft = {
  kind: CouponRule['kind'];
  value: number | null;
  config: Record<string, unknown>;
  applies_to: { all?: boolean; product_ids?: string[]; categories?: string[] };
};

const RULE_KINDS: CouponRule['kind'][] = ['percent', 'fixed', 'free_shipping', 'bxgy', 'gift_product'];

// Etiquetas en español simple para el tipo de beneficio.
const RULE_LABELS: Record<CouponRule['kind'], string> = {
  percent: 'Porcentaje de descuento',
  fixed: 'Monto fijo de descuento',
  free_shipping: 'Envío gratis',
  bxgy: 'Llevá más pagando menos (ej. 2x1)',
  gift_product: 'Regalá un producto',
};

// Descripciones que muestran qué hace cada tipo de regla.
// Diseñadas para que un usuario no técnico entienda la diferencia.
const RULE_DESCRIPTIONS: Record<CouponRule['kind'], string> = {
  percent: 'Descuenta un % del subtotal de los productos que aplique. Ej: 20 = 20% off.',
  fixed: 'Resta un monto fijo en pesos del subtotal. Ej: 100 = $100 off.',
  free_shipping: 'El envío del pedido sale gratis.',
  bxgy:
    'Por cada N unidades compradas, las M siguientes se bonifican. Ej: comprá 2, llevá 1 gratis (2x1).',
  gift_product:
    'Suma un producto de regalo al carrito cuando se cumple la condición. No descuenta plata, suma un ítem.',
};

const APPLIES_LABELS = {
  all: 'Todo el carrito',
  categories: 'Por categoría',
  products: 'Productos específicos',
} as const;
type AppliesMode = keyof typeof APPLIES_LABELS;

const blankRule = (): RuleDraft => ({
  kind: 'percent',
  value: 10,
  config: {},
  applies_to: { all: true },
});

// Estilos compartidos (carbon theme)
const inputBase =
  'w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none disabled:opacity-50';
const selectBase = inputBase + ' [&>option]:bg-carbon';
const labelEyebrow =
  'mb-1 block font-body text-[10px] uppercase tracking-ultra text-bone/50';

// Steps del formulario. Cada paso colapsa para reducir carga visual.
type Step = 'basicos' | 'vigencia' | 'audiencia' | 'reglas';
const STEPS: { id: Step; title: string; subtitle: string }[] = [
  { id: 'basicos', title: 'Identidad', subtitle: 'Cómo lo van a ver tus clientes' },
  { id: 'vigencia', title: 'Vigencia y límites', subtitle: 'Cuándo y cuánto se puede usar' },
  { id: 'audiencia', title: 'Audiencia', subtitle: 'A quién le aplica' },
  { id: 'reglas', title: 'Beneficios', subtitle: 'Qué otorga el cupón' },
];

export default function CouponsAdmin({ initialCoupons, products }: Props) {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Pasos colapsados (todos abiertos por defecto para descubrimiento fácil)
  const [openSteps, setOpenSteps] = useState<Record<Step, boolean>>({
    basicos: true,
    vigencia: true,
    audiencia: true,
    reglas: true,
  });

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

  function flash(kind: 'success' | 'error', message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  function toggleStep(s: Step) {
    setOpenSteps((prev) => ({ ...prev, [s]: !prev[s] }));
  }

  async function handleCreate() {
    setError(null);

    // Validación rápida: al menos una regla con valor (cuando aplique)
    if (!code.trim()) {
      setError('Ingresá un código para el cupón.');
      return;
    }
    const incompleteRule = rules.find((r) => {
      if (r.kind === 'percent' || r.kind === 'fixed') return r.value === null || r.value <= 0;
      if (r.kind === 'bxgy') {
        const cfg = r.config as any;
        return !cfg.buy_qty || !cfg.get_qty;
      }
      if (r.kind === 'gift_product') {
        const cfg = r.config as any;
        return !cfg.gift_product_id;
      }
      return false;
    });
    if (incompleteRule) {
      setError(`La regla "${incompleteRule.kind}" está incompleta. Revisá sus campos.`);
      return;
    }

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
      flash('error', 'No pudimos crear el cupón.');
      return;
    }
    setShowForm(false);
    setCode(''); setDescription(''); setMinSubtotal(''); setMaxDiscount('');
    setUsageLimit(''); setPerUserLimit(''); setCombinable(false);
    setCustomerType(''); setStartsAt(''); setEndsAt('');
    setRules([blankRule()]);
    flash('success', `Cupón ${code.toUpperCase()} creado y activo.`);
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
      flash('success', `Cupón ${c.code} ${!c.is_active ? 'activado' : 'desactivado'}.`);
    } else {
      flash('error', 'No pudimos cambiar el estado del cupón.');
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`¿Eliminar el cupón ${code}? Sus redenciones históricas se conservan.`)) return;
    const res = await fetch(`/api/admin/coupons?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCoupons((prev) => prev.filter((x) => x.id !== id));
      flash('success', `Cupón ${code} eliminado.`);
    } else {
      flash('error', 'No pudimos eliminar el cupón.');
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

  function addRule() {
    setRules((prev) => [...prev, blankRule()]);
  }

  function removeRule(idx: number) {
    setRules((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== idx)));
  }

  const activeCount = useMemo(
    () => coupons.filter((c) => c.is_active).length,
    [coupons]
  );

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone">Cupones</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            {coupons.length} configurado{coupons.length === 1 ? '' : 's'} · {activeCount} activo{activeCount === 1 ? '' : 's'}.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-full bg-gold px-6 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
          >
            + Nuevo cupón
          </button>
        )}
      </header>

      {toast && (
        <div
          role="status"
          className={[
            'mb-4 border px-4 py-3 font-body text-sm',
            toast.kind === 'success'
              ? 'border-gold/40 bg-gold/10 text-gold'
              : 'border-red-500/40 bg-red-500/10 text-red-300',
          ].join(' ')}
        >
          {toast.message}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="mb-10 border border-carbon-line bg-carbon"
        >
          <div className="flex items-center justify-between border-b border-carbon-line px-4 py-4 sm:px-6">
            <div>
              <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
                Nuevo cupón
              </p>
              <p className="mt-1 font-display text-lg text-bone">
                {code ? code.toUpperCase() : 'Sin código todavía'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone"
            >
              Cancelar
            </button>
          </div>

          <div className="divide-y divide-carbon-line">
            <Section
              step={STEPS[0]}
              open={openSteps.basicos}
              onToggle={() => toggleStep('basicos')}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Código" hint="Es el texto que el cliente ingresa en el checkout. Mayúsculas, sin espacios.">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VERANO20"
                    required
                    className={inputBase + ' font-mono uppercase'}
                  />
                </Field>
                <Field label="Descripción" hint="Texto interno para que vos identifiques el cupón.">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="20% off en vinos"
                    className={inputBase}
                  />
                </Field>
              </div>
            </Section>

            <Section
              step={STEPS[1]}
              open={openSteps.vigencia}
              onToggle={() => toggleStep('vigencia')}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Inicio" hint="Opcional. Si lo dejás vacío, empieza ahora.">
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className={inputBase}
                  />
                </Field>
                <Field label="Fin" hint="Opcional. Si lo dejás vacío, no vence.">
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={inputBase}
                  />
                </Field>
                <Field label="Mínimo de compra" hint="Subtotal mínimo del carrito para que aplique.">
                  <input
                    type="number"
                    value={minSubtotal}
                    onChange={(e) => setMinSubtotal(e.target.value)}
                    placeholder="0"
                    min={0}
                    className={inputBase}
                  />
                </Field>
                <Field label="Tope de descuento" hint="Monto máximo a descontar (cápsula de seguridad).">
                  <input
                    type="number"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    placeholder="Sin tope"
                    min={0}
                    className={inputBase}
                  />
                </Field>
                <Field label="Usos totales" hint="Cantidad máxima de canjes en todo el cupón.">
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder="Sin límite"
                    min={1}
                    className={inputBase}
                  />
                </Field>
                <Field label="Usos por usuario" hint="Cuántas veces lo puede canjear una misma persona.">
                  <input
                    type="number"
                    value={perUserLimit}
                    onChange={(e) => setPerUserLimit(e.target.value)}
                    placeholder="Sin límite"
                    min={1}
                    className={inputBase}
                  />
                </Field>
              </div>
            </Section>

            <Section
              step={STEPS[2]}
              open={openSteps.audiencia}
              onToggle={() => toggleStep('audiencia')}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tipo de cliente" hint="Si lo limitás a un solo segmento.">
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
                <Field label="Combinable" hint="Si permitís que se use junto con otros cupones en el mismo carrito.">
                  <label className="mt-2 flex items-center gap-2 font-body text-sm text-bone/80">
                    <input
                      type="checkbox"
                      checked={combinable}
                      onChange={(e) => setCombinable(e.target.checked)}
                      className="h-4 w-4 accent-gold"
                    />
                    {combinable ? 'Sí, combinable' : 'No, exclusivo'}
                  </label>
                </Field>
              </div>
            </Section>

            <Section
              step={STEPS[3]}
              open={openSteps.reglas}
              onToggle={() => toggleStep('reglas')}
              right={
                <button
                  type="button"
                  onClick={addRule}
                  className="font-body text-[10px] uppercase tracking-ultra text-gold hover:underline"
                >
                  + Agregar regla
                </button>
              }
            >
              {rules.length === 0 ? (
                <p className="font-body text-sm text-bone/50">
                  Este cupón todavía no otorga ningún beneficio. Agregá al menos una regla.
                </p>
              ) : (
                <div className="space-y-4">
                  {rules.map((r, i) => (
                    <RuleCard
                      key={i}
                      index={i}
                      rule={r}
                      canRemove={rules.length > 1}
                      products={products}
                      onChange={(patch) => updateRule(i, patch)}
                      onConfigChange={(key, val) => updateRuleConfig(i, key, val)}
                      onRemove={() => removeRule(i)}
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {error && (
            <p className="border-t border-carbon-line bg-red-500/10 px-4 py-3 font-body text-sm text-red-300 sm:px-6">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-carbon-line px-4 py-4 sm:px-6">
            <p className="font-body text-xs text-bone/50">
              El cupón se crea <strong className="text-bone">activo</strong>. Podés desactivarlo desde la lista.
            </p>
            <div className="flex gap-3">
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
                {isPending ? 'Creando…' : 'Crear cupón'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="p-4">Código</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Beneficios</th>
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
                  {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ' (sin tope)'}
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
                      onClick={() => handleDelete(c.id, c.code)}
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
                  No hay cupones todavía. Hacé click en <span className="text-gold">+ Nuevo cupón</span> para crear el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({
  step,
  open,
  onToggle,
  right,
  children,
}: {
  step: { title: string; subtitle: string };
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-carbon-raised/40 sm:px-6"
      >
        <div className="min-w-0">
          <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
            {open ? '▾' : '▸'} {step.title}
          </p>
          <p className="mt-0.5 font-body text-xs text-bone/50">{step.subtitle}</p>
        </div>
        {right && <div onClick={(e) => e.stopPropagation()}>{right}</div>}
      </button>
      {open && <div className="px-4 pb-5 sm:px-6">{children}</div>}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelEyebrow}>{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block font-body text-[11px] text-bone/45">
          {hint}
        </span>
      )}
    </label>
  );
}

function RuleCard({
  index,
  rule,
  canRemove,
  products,
  onChange,
  onConfigChange,
  onRemove,
}: {
  index: number;
  rule: RuleDraft;
  canRemove: boolean;
  products: PickerProduct[];
  onChange: (patch: Partial<RuleDraft>) => void;
  onConfigChange: (key: string, value: unknown) => void;
  onRemove: () => void;
}) {
  // Modo de aplicación: derivar del shape actual de applies_to
  const appliesMode: AppliesMode = rule.applies_to.all
    ? 'all'
    : rule.applies_to.product_ids
      ? 'products'
      : 'categories';
  const selectedProductIds = rule.applies_to.product_ids ?? [];

  function setAppliesMode(mode: AppliesMode) {
    if (mode === 'all') onChange({ applies_to: { all: true } });
    else if (mode === 'products')
      onChange({ applies_to: { product_ids: selectedProductIds.length ? selectedProductIds : [] } });
    else onChange({ applies_to: { categories: [] } });
  }

  function toggleProduct(productId: string) {
    const next = selectedProductIds.includes(productId)
      ? selectedProductIds.filter((id) => id !== productId)
      : [...selectedProductIds, productId];
    onChange({ applies_to: { product_ids: next } });
  }

  return (
    <div className="border border-carbon-line bg-carbon-raised">
      <div className="flex items-center justify-between border-b border-carbon-line px-4 py-2">
        <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
          Regla #{index + 1}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="font-body text-[10px] uppercase tracking-ultra text-red-400 hover:text-red-300"
          >
            Quitar
          </button>
        )}
      </div>
      <div className="space-y-4 px-4 py-4">
        <Field label="¿Qué beneficio otorga esta regla?" hint="Elegí la acción principal. Abajo te explicamos cada una en simple.">
          <select
            value={rule.kind}
            onChange={(e) => onChange({ kind: e.target.value as CouponRule['kind'] })}
            className={selectBase}
          >
            {RULE_KINDS.map((k) => (
              <option key={k} value={k}>{RULE_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        <p className="rounded border border-gold/30 bg-gold/5 px-3 py-2 font-body text-xs italic text-bone/75">
          {RULE_DESCRIPTIONS[rule.kind]}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(rule.kind === 'percent' || rule.kind === 'fixed') && (
            <Field
              label={rule.kind === 'percent' ? 'Porcentaje' : 'Monto fijo'}
              hint={rule.kind === 'percent' ? 'Ej: 20 = 20% off.' : 'Monto en la moneda del cupón.'}
            >
              <input
                type="number"
                value={rule.value ?? ''}
                onChange={(e) =>
                  onChange({ value: e.target.value === '' ? null : Number(e.target.value) })
                }
                min={0}
                className={inputBase}
              />
            </Field>
          )}
          <Field label="¿A qué productos aplica?">
            <select
              value={appliesMode}
              onChange={(e) => setAppliesMode(e.target.value as AppliesMode)}
              className={selectBase}
            >
              {(Object.entries(APPLIES_LABELS) as [AppliesMode, string][]).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </Field>
        </div>

        {appliesMode === 'products' && (
          <ProductPicker
            products={products}
            selectedIds={selectedProductIds}
            onToggle={toggleProduct}
          />
        )}

        {appliesMode === 'categories' && (
          <CategoryPickerHint />
        )}

        {rule.kind === 'bxgy' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Comprá (qty)" hint="Cantidad que el cliente debe llevar para activar la promo.">
              <input
                type="number" min={1}
                value={(rule.config as any).buy_qty ?? ''}
                onChange={(e) => onConfigChange('buy_qty', Number(e.target.value))}
                className={inputBase}
              />
            </Field>
            <Field label="Llevás (qty)" hint="Unidades bonificadas que se suman.">
              <input
                type="number" min={1}
                value={(rule.config as any).get_qty ?? ''}
                onChange={(e) => onConfigChange('get_qty', Number(e.target.value))}
                className={inputBase}
              />
            </Field>
            <Field label="% descuento en el regalo" hint="100 = totalmente gratis.">
              <input
                type="number" min={0} max={100}
                value={(rule.config as any).get_discount_pct ?? 100}
                onChange={(e) => onConfigChange('get_discount_pct', Number(e.target.value))}
                className={inputBase}
              />
            </Field>
          </div>
        )}

        {rule.kind === 'gift_product' && (
          <GiftProductPicker
            products={products}
            selectedId={(rule.config as any).gift_product_id ?? ''}
            onSelect={(id) => onConfigChange('gift_product_id', id)}
          />
        )}
      </div>
    </div>
  );
}

function ProductPicker({
  products,
  selectedIds,
  onToggle,
}: {
  products: PickerProduct[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<'all' | PickerProduct['audience']>('all');

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return products.filter((p) => {
      if (audienceFilter !== 'all' && p.audience !== audienceFilter) return false;
      if (!norm) return true;
      return (
        p.name.toLowerCase().includes(norm) ||
        p.id.toLowerCase().includes(norm) ||
        p.category.toLowerCase().includes(norm)
      );
    });
  }, [products, q, audienceFilter]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-body text-[10px] uppercase tracking-ultra text-bone/55">
          Productos seleccionados ({selectedIds.length})
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-carbon-line">
            {(
              [
                ['all', 'Todos'],
                ['retail', 'Minorista'],
                ['wholesale', 'Mayorista'],
                ['both', 'Ambos'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAudienceFilter(key)}
                className={[
                  'px-3 py-1 font-body text-[10px] uppercase tracking-ultra transition',
                  audienceFilter === key
                    ? 'bg-gold text-carbon'
                    : 'text-bone/60 hover:bg-carbon-raised hover:text-bone',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-40 border-b border-carbon-line bg-transparent px-2 py-1 font-body text-xs text-bone focus:border-gold outline-none"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded border border-carbon-line bg-carbon p-4 text-center font-body text-sm text-bone/50">
          No hay productos que coincidan con esos filtros.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const selected = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p.id)}
                className={[
                  'group relative overflow-hidden border bg-carbon text-left transition',
                  selected
                    ? 'border-gold ring-2 ring-gold/40'
                    : 'border-carbon-line hover:border-gold/60',
                ].join(' ')}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-carbon-raised">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-body text-xs text-bone/40">
                      sin imagen
                    </div>
                  )}
                  {selected && (
                    <span className="absolute right-2 top-2 rounded-full bg-gold px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-carbon">
                      ✓
                    </span>
                  )}
                  <span
                    className={[
                      'absolute left-2 top-2 rounded-full px-2 py-0.5 font-body text-[9px] uppercase tracking-ultra',
                      AUDIENCE_STYLES[p.audience],
                    ].join(' ')}
                  >
                    {p.audience === 'wholesale' ? 'Mayorista' : p.audience === 'both' ? 'Ambos' : 'Minorista'}
                  </span>
                </div>
                <div className="p-2">
                  <p className="line-clamp-1 font-body text-xs font-medium text-bone">{p.name}</p>
                  <p className="mt-0.5 font-body text-[11px] text-bone/50">
                    {p.currency} {p.price.toFixed(0)} · {p.category}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GiftProductPicker({
  products,
  selectedId,
  onSelect,
}: {
  products: PickerProduct[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [audienceFilter, setAudienceFilter] = useState<'all' | PickerProduct['audience']>('all');
  const filtered = useMemo(
    () =>
      audienceFilter === 'all'
        ? products
        : products.filter((p) => p.audience === audienceFilter),
    [products, audienceFilter]
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-body text-[10px] uppercase tracking-ultra text-bone/55">
          Elegí el producto a regalar
        </p>
        <div className="flex overflow-hidden rounded-full border border-carbon-line">
          {(
            [
              ['all', 'Todos'],
              ['retail', 'Minorista'],
              ['wholesale', 'Mayorista'],
              ['both', 'Ambos'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAudienceFilter(key)}
              className={[
                'px-3 py-1 font-body text-[10px] uppercase tracking-ultra transition',
                audienceFilter === key
                  ? 'bg-gold text-carbon'
                  : 'text-bone/60 hover:bg-carbon-raised hover:text-bone',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded border border-carbon-line bg-carbon p-4 text-center font-body text-sm text-bone/50">
          No hay productos activos en el catálogo para ese filtro.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const selected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className={[
                  'group relative overflow-hidden border bg-carbon text-left transition',
                  selected
                    ? 'border-gold ring-2 ring-gold/40'
                    : 'border-carbon-line hover:border-gold/60',
                ].join(' ')}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-carbon-raised">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-body text-xs text-bone/40">
                      sin imagen
                    </div>
                  )}
                  {selected && (
                    <span className="absolute right-2 top-2 rounded-full bg-gold px-2 py-0.5 font-body text-[10px] uppercase tracking-ultra text-carbon">
                      regalo
                    </span>
                  )}
                  <span
                    className={[
                      'absolute left-2 top-2 rounded-full px-2 py-0.5 font-body text-[9px] uppercase tracking-ultra',
                      AUDIENCE_STYLES[p.audience],
                    ].join(' ')}
                  >
                    {p.audience === 'wholesale' ? 'Mayorista' : p.audience === 'both' ? 'Ambos' : 'Minorista'}
                  </span>
                </div>
                <div className="p-2">
                  <p className="line-clamp-1 font-body text-xs font-medium text-bone">{p.name}</p>
                  <p className="mt-0.5 font-body text-[11px] text-bone/50">
                    {p.currency} {p.price.toFixed(0)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryPickerHint() {
  return (
    <p className="rounded border border-carbon-line bg-carbon px-3 py-2 font-body text-xs text-bone/55">
      La selección de categorías específicas se administra desde{' '}
      <span className="text-bone">Productos → Categorías</span>. Por ahora la
      promo aplica a todas las categorías.
    </p>
  );
}