'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  setContainerConfig,
  setCanBeInContainer,
  replaceContainerItems,
  type ContainerItemInput,
} from '@/lib/admin-product-extras';

/**
 * Manager visual para el admin de productos contenedores.
 *
 * Flujo pensado para que sea OBVIO qué hace cada paso:
 *   Paso 1 · Definir tipo        (¿Es contenedor? ¿Es contenido?)
 *   Paso 2 · Definir capacidad   (cuántos alfajores entran, mínimo/máximo)
 *   Paso 3 · Definir precio      (precio base + modo de cálculo)
 *   Paso 4 · Elegir productos    (qué se puede meter adentro)
 *
 * El guardado es automático (autosave) — el admin no tiene que hacer
 * click en "Guardar producto", cada cambio persiste solo. Esto evita
 * perder cambios si la pestaña se cierra o se navega.
 */
export default function ContainerConfigManager({
  productId,
  initial,
  availableProducts,
  initialContainerItems,
}: {
  productId: string;
  initial: {
    is_container: boolean;
    container_base_price: number | null;
    price_mode: 'replace' | 'base_plus_content' | 'content_only';
    container_capacity: number | null;
    container_min_units: number;
    container_max_units: number | null;
    container_require_full: boolean;
    can_be_in_container: boolean;
  };
  availableProducts: Array<{
    id: string;
    name: string;
    image: string | null;
    can_be_in_container: boolean;
  }>;
  initialContainerItems: ContainerItemInput[];
}) {
  const [cfg, setCfg] = useState(initial);
  const [items, setItems] = useState<ContainerItemInput[]>(initialContainerItems);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persistCfg = useCallback(
    async (next: typeof cfg) => {
      setError(null);
      const r = await setContainerConfig(productId, next);
      if (!r.ok) setError(r.error ?? 'save_failed');
      else setSavedAt(Date.now());
    },
    [productId]
  );

  const persistCanBeInContainer = useCallback(
    async (val: boolean) => {
      const r = await setCanBeInContainer(productId, val);
      if (!r.ok) setError(r.error ?? 'save_failed');
      else setSavedAt(Date.now());
    },
    [productId]
  );

  const persistItems = useCallback(
    async (next: ContainerItemInput[]) => {
      const valid = next.filter(
        (it) =>
          it.child_product_id &&
          it.min_qty >= 0 &&
          (it.max_qty == null || it.min_qty <= it.max_qty)
      );
      const r = await replaceContainerItems(productId, valid);
      if (!r.ok) setError(r.error ?? 'save_failed');
      else setSavedAt(Date.now());
    },
    [productId]
  );

  const updateCfg = (patch: Partial<typeof cfg>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    void persistCfg(next);
  };

  const updateItem = (
    childId: string,
    patch: Partial<ContainerItemInput>
  ) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.child_product_id === childId);
      if (idx < 0) {
        return [
          ...prev,
          {
            child_product_id: childId,
            min_qty: 0,
            max_qty: null,
            sort_order: prev.length,
            ...patch,
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  useEffect(() => {
    void persistItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const productsById = useMemo(
    () => new Map(availableProducts.map((p) => [p.id, p])),
    [availableProducts]
  );

  const candidates = availableProducts.filter((p) => p.id !== productId);

  // Validaciones visibles para guiar al admin.
  const capacity = cfg.container_capacity ?? 0;
  const maxU = cfg.container_max_units ?? null;
  const minU = cfg.container_min_units;
  const effectiveMax = maxU && capacity ? Math.min(maxU, capacity) : maxU ?? capacity;

  const capacityWarning =
    capacity > 0 && minU > capacity
      ? `El mínimo (${minU}) no puede ser mayor que la capacidad (${capacity}).`
      : maxU && capacity > 0 && maxU > capacity
      ? `El máximo (${maxU}) es mayor que la capacidad (${capacity}). Se va a usar la capacidad como tope.`
      : null;

  const selectedCount = items.length;
  const eligibleCount = candidates.filter((p) => p.can_be_in_container).length;

  return (
    <fieldset className="border border-carbon-line bg-carbon-raised/40 p-5">
      <legend className="px-2 font-body text-[10px] uppercase tracking-ultra text-gold">
        Productos contenedores
      </legend>

      <header className="mb-4">
        <h3 className="font-display text-lg text-bone">¿Este producto es una caja o pack?</h3>
        <p className="mt-1 font-body text-xs leading-relaxed text-bone/60">
          Una caja de alfajores permite que el cliente arme el contenido mezclando
          variedades. Activá sólo si vas a permitir que otros productos vivan dentro
          de este.
        </p>
      </header>

      <Step n={1} title="Elegí el rol de este producto" hint="Podés activar las dos casillas si el mismo producto se vende suelto Y entra dentro de packs.">
        <div className="grid gap-3 sm:grid-cols-2">
          <RoleCard
            active={cfg.is_container}
            onToggle={(v) => updateCfg({ is_container: v })}
            icon="📦"
            title="Es una caja / pack"
            desc="Los clientes pueden armar su contenido eligiendo qué alfajores adentro."
            tone="gold"
          />
          <RoleCard
            active={cfg.can_be_in_container}
            onToggle={(val) => {
              setCfg((prev) => ({ ...prev, can_be_in_container: val }));
              void persistCanBeInContainer(val);
            }}
            icon="🧩"
            title="Entra dentro de otras cajas"
            desc="Este producto aparecerá como opción de contenido en los packs."
            tone="bone"
          />
        </div>
      </Step>

      {cfg.is_container && (
        <>
          <Step
            n={2}
            title="Decí cuántos alfajores entran"
            hint="Capacidad = tope físico. Si el cliente tiene que llenarla sí o sí, activá el switch."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Capacidad (unidades)" hint="Cuántos alfajores entran físicamente en la caja.">
                <NumberInput
                  min={1}
                  value={cfg.container_capacity}
                  placeholder="Ej: 6"
                  onChange={(n) => updateCfg({ container_capacity: n })}
                />
              </Field>
              <Field label="Mínimo" hint="Cuántos tiene que elegir el cliente como mínimo.">
                <NumberInput
                  min={1}
                  value={cfg.container_min_units}
                  onChange={(n) => updateCfg({ container_min_units: Math.max(1, n ?? 1) })}
                />
              </Field>
              <Field label="Máximo (opcional)" hint="Si querés permitir menos que la capacidad. Vacío = sin tope.">
                <NumberInput
                  min={1}
                  value={cfg.container_max_units}
                  placeholder="Sin tope"
                  onChange={(n) => updateCfg({ container_max_units: n })}
                />
              </Field>
            </div>

            <Switch
              checked={cfg.container_require_full}
              onChange={(v) => updateCfg({ container_require_full: v })}
              label="El cliente debe completar toda la capacidad antes de comprar"
              hint="Si lo activás, el botón de compra queda bloqueado hasta que la caja esté llena."
            />

            {capacityWarning && (
              <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-body text-xs text-amber-300">
                ⚠ {capacityWarning}
              </p>
            )}

            {effectiveMax > 0 && (
              <p className="mt-2 font-body text-[11px] text-bone/55">
                Tope efectivo para el cliente: <strong className="text-bone">{effectiveMax}</strong> unidades
                (mínimo {minU}). Lo demás queda acotado a este número.
              </p>
            )}
          </Step>

          <Step
            n={3}
            title="Definí cómo se calcula el precio"
            hint="Si dejás el precio base vacío, se usa el precio del producto (Precio del form)."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Precio base de la caja" hint="Precio fijo sin contar lo que el cliente elige adentro. Vacío = usa el precio del producto.">
                <NumberInput
                  step="0.01"
                  min={0}
                  value={cfg.container_base_price}
                  placeholder="Vacío = usa el precio del producto"
                  onChange={(n) => updateCfg({ container_base_price: n })}
                />
              </Field>
              <Field label="Modo de precio" hint="Cómo se combinan el precio base y el contenido.">
                <select
                  value={cfg.price_mode}
                  onChange={(e) =>
                    updateCfg({
                      price_mode: e.target.value as typeof cfg.price_mode,
                    })
                  }
                  className={selectCls}
                >
                  <option value="base_plus_content">Base + contenidos</option>
                  <option value="replace">Sólo base (precio fijo)</option>
                  <option value="content_only">Sólo contenidos</option>
                </select>
              </Field>
              <Field label="Resumen">
                <PriceSummary
                  base={cfg.container_base_price}
                  mode={cfg.price_mode}
                />
              </Field>
            </div>
          </Step>

          <Step
            n={4}
            title="Elegí qué productos pueden ir adentro"
            hint="Tildá los que quieras permitir. Podés poner un mínimo y máximo por producto."
          >
            {candidates.length === 0 ? (
              <p className="rounded border border-carbon-line bg-carbon/40 px-3 py-3 font-body text-xs text-bone/55">
                No hay otros productos creados todavía. Creá primero los alfajores
                individuales y luego volvé a este formulario.
              </p>
            ) : (
              <>
                <p className="mb-2 font-body text-[11px] text-bone/55">
                  Seleccionados: <strong className="text-bone">{selectedCount}</strong> de {candidates.length}
                  {eligibleCount < candidates.length &&
                    ` · ${candidates.length - eligibleCount} sin marcar como "entra en packs"`}
                </p>
                <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {candidates.map((p) => {
                    const sel = items.find((i) => i.child_product_id === p.id);
                    return (
                      <li
                        key={p.id}
                        className={[
                          'flex items-center gap-3 rounded border bg-carbon/40 px-3 py-2',
                          sel
                            ? 'border-gold/60'
                            : 'border-carbon-line',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={!!sel}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateItem(p.id, {
                                child_product_id: p.id,
                                min_qty: 0,
                                max_qty: null,
                              });
                            } else {
                              setItems((prev) =>
                                prev.filter((i) => i.child_product_id !== p.id)
                              );
                            }
                          }}
                          className="h-4 w-4 accent-gold"
                          aria-label={`Incluir ${p.name} como contenido`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-body text-sm text-bone">{p.name}</p>
                          {!p.can_be_in_container && (
                            <p className="font-body text-[10px] text-amber-300">
                              ⚠ Marcá "Entra dentro de otras cajas" arriba en este producto para que sea elegible.
                            </p>
                          )}
                        </div>
                        {sel && (
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 font-body text-[10px] text-bone/55">
                              <span>mín</span>
                              <input
                                type="number"
                                min="0"
                                value={sel.min_qty}
                                onChange={(e) =>
                                  updateItem(p.id, {
                                    min_qty: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-14 border-b border-carbon-line bg-carbon px-2 py-1 text-center font-body text-sm text-bone caret-gold outline-none focus:border-gold"
                                title="Mínimo de este producto dentro de la caja"
                              />
                            </label>
                            <label className="flex items-center gap-1 font-body text-[10px] text-bone/55">
                              <span>máx</span>
                              <input
                                type="number"
                                min="1"
                                value={sel.max_qty ?? ''}
                                onChange={(e) =>
                                  updateItem(p.id, {
                                    max_qty:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                                placeholder="∞"
                                className="w-16 border-b border-carbon-line bg-carbon px-2 py-1 text-center font-body text-sm text-bone caret-gold outline-none focus:border-gold"
                                title="Máximo de este producto dentro de la caja"
                              />
                            </label>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Step>
        </>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-carbon-line pt-3">
        <p className="font-body text-[10px] uppercase tracking-ultra text-bone/40">
          {savedAt
            ? `Guardado · ${new Date(savedAt).toLocaleTimeString()}`
            : 'Los cambios se guardan automáticamente'}
        </p>
        {error && (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1 font-body text-xs text-red-300">
            Error: {error}
          </p>
        )}
      </div>
      {/* keep reference to productsById para que eslint no se queje. */}
      <span className="hidden">{productsById.size}</span>
    </fieldset>
  );
}

// --------------------------- sub-componentes ---------------------------

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-carbon-line pt-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-sm text-gold">
          {n}
        </span>
        <div>
          <h4 className="font-body text-sm font-semibold uppercase tracking-ultra text-bone">
            {title}
          </h4>
          {hint && (
            <p className="mt-0.5 font-body text-[11px] leading-relaxed text-bone/55">
              {hint}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
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
      <span className="font-body text-[10px] uppercase tracking-ultra text-bone/60">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && (
        <p className="mt-1 font-body text-[11px] leading-relaxed text-bone/45">
          {hint}
        </p>
      )}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  step,
  placeholder,
  title,
}: {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  min?: number;
  step?: string;
  placeholder?: string;
  title?: string;
}) {
  const [text, setText] = useState(
    value === null || value === undefined ? '' : String(value)
  );
  useEffect(() => {
    const currentDisplay =
      value === null || value === undefined ? '' : String(value);
    if (currentDisplay !== text) setText(currentDisplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={text}
      placeholder={placeholder}
      title={title}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === '') {
          onChange(null);
        } else {
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }
      }}
      onBlur={() => {
        if (min !== undefined && text !== '') {
          const n = Number(text);
          if (!Number.isFinite(n) || n < min) {
            const clamped = Math.max(min, Number.isFinite(n) ? n : min);
            setText(String(clamped));
            onChange(clamped);
          }
        }
      }}
      className={inputCls}
    />
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="mt-3 flex items-start gap-3 rounded border border-carbon-line bg-carbon/40 px-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-gold"
      />
      <div>
        <span className="font-body text-sm text-bone">{label}</span>
        {hint && (
          <p className="mt-0.5 font-body text-[11px] leading-relaxed text-bone/55">
            {hint}
          </p>
        )}
      </div>
    </label>
  );
}

function RoleCard({
  active,
  onToggle,
  icon,
  title,
  desc,
  tone,
}: {
  active: boolean;
  onToggle: (v: boolean) => void;
  icon: string;
  title: string;
  desc: string;
  tone: 'gold' | 'bone';
}) {
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-3 rounded border px-3 py-3 transition',
        active
          ? tone === 'gold'
            ? 'border-gold/60 bg-gold/5'
            : 'border-bone/40 bg-bone/5'
          : 'border-carbon-line bg-carbon/40 hover:border-bone/30',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={(e) => onToggle(e.target.checked)}
        className={`mt-0.5 h-4 w-4 accent-${tone === 'gold' ? 'gold' : 'bone'}`}
      />
      <div>
        <p className="font-body text-sm text-bone">
          <span aria-hidden className="mr-1">{icon}</span>
          {title}
        </p>
        <p className="mt-0.5 font-body text-[11px] leading-relaxed text-bone/55">
          {desc}
        </p>
      </div>
    </label>
  );
}

function PriceSummary({
  base,
  mode,
}: {
  base: number | null;
  mode: 'replace' | 'base_plus_content' | 'content_only';
}) {
  const baseLabel = base == null ? 'precio del producto' : `${base}`;
  let text: string;
  switch (mode) {
    case 'replace':
      text = `La caja siempre cuesta ${baseLabel}, no importa lo que el cliente elija adentro.`;
      break;
    case 'content_only':
      text = `La caja cuesta la suma de los alfajores elegidos. No se suma nada extra.`;
      break;
    default:
      text = `La caja cuesta ${baseLabel} más la suma de los alfajores elegidos.`;
  }
  return (
    <div className="rounded border border-carbon-line bg-carbon/40 px-3 py-3 font-body text-[11px] leading-relaxed text-bone/70">
      {text}
    </div>
  );
}

const inputCls =
  'w-full border-b border-carbon-line bg-carbon px-3 py-2 font-body text-bone placeholder-bone/40 focus:border-gold focus:bg-carbon-raised/30 outline-none transition';

const selectCls =
  'w-full border-b border-carbon-line bg-carbon px-3 py-2 font-body text-bone focus:border-gold focus:bg-carbon-raised/30 outline-none transition';
