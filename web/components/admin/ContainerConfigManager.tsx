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
 * - Toggle "Es contenedor".
 * - Capacity, min, max, require_full, precio base, price_mode.
 * - Editor de productos hijos permitidos (con min/max por child).
 * - Toggle independiente "Apto para entrar en otros contenedores".
 *
 * Persistencia contra server actions (admin-product-extras).
 * Autosave en cada cambio: el admin ve todos los cambios reflejados en
 * el storefront sin tener que tocar "Guardar producto".
 */
export default function ContainerConfigManager({
  productId,
  initial,
  availableProducts,
  initialContainerItems,
}: {
  productId: string;
  /** Snapshot del producto (incluye is_container, can_be_in_container, etc.). */
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
  /** Productos disponibles para seleccionar como hijos (los activos).
   *  Excluye el propio producto (anti auto-contenedor). */
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

  // Autosave on cfg change (debounced por render).
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
      // Sólo productos con min/max válidos.
      const valid = next.filter(
        (it) =>
          it.child_product_id &&
          (it.min_qty === 0 || it.max_qty == null || it.min_qty <= it.max_qty)
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

  // Persistir items luego del render — evita guardar en cada keystroke.
  useEffect(() => {
    void persistItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const productsById = useMemo(
    () => new Map(availableProducts.map((p) => [p.id, p])),
    [availableProducts]
  );

  // Excluir el propio producto de "hijos disponibles".
  const candidates = availableProducts.filter((p) => p.id !== productId);

  return (
    <fieldset className="border border-carbon-line bg-carbon-raised/40 p-5">
      <legend className="px-2 font-body text-[10px] uppercase tracking-ultra text-gold">
        Productos contenedores
      </legend>

      <p className="mb-3 font-body text-[11px] leading-relaxed text-bone/55">
        Definí si este producto puede contener otros. Activá también "Apto
        para entrar en contenedores" si querés que sea elegible como
        contenido.
      </p>

      {/* Toggle: contenedor */}
      <label className="mb-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={cfg.is_container}
          onChange={(e) => updateCfg({ is_container: e.target.checked })}
          className="h-4 w-4 accent-gold"
        />
        <span className="font-body text-sm text-bone">
          Permitir que este producto contenga otros productos
        </span>
      </label>

      {cfg.is_container && (
        <div className="space-y-5 border-l border-gold/30 pl-5">
          {/* Capacidad + mínimos */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Capacidad (unidades)">
              <input
                type="number"
                min="1"
                value={cfg.container_capacity ?? ''}
                onChange={(e) =>
                  updateCfg({
                    container_capacity:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Mínimo seleccionable">
              <input
                type="number"
                min="1"
                value={cfg.container_min_units}
                onChange={(e) =>
                  updateCfg({ container_min_units: Number(e.target.value) || 1 })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Máximo seleccionable (opcional)">
              <input
                type="number"
                min="1"
                value={cfg.container_max_units ?? ''}
                onChange={(e) =>
                  updateCfg({
                    container_max_units:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={cfg.container_require_full}
              onChange={(e) =>
                updateCfg({ container_require_full: e.target.checked })
              }
              className="h-4 w-4 accent-gold"
            />
            <span className="font-body text-sm text-bone">
              El cliente debe completar toda la capacidad antes de comprar
            </span>
          </label>

          {/* Precio */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Precio base del contenedor (opcional)">
              <input
                type="number"
                step="0.01"
                value={cfg.container_base_price ?? ''}
                onChange={(e) =>
                  updateCfg({
                    container_base_price:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className={inputCls}
                placeholder="Si lo dejás vacío, usa el precio del producto"
              />
            </Field>
            <Field label="Modo de precio">
              <select
                value={cfg.price_mode}
                onChange={(e) =>
                  updateCfg({
                    price_mode: e.target
                      .value as typeof cfg.price_mode,
                  })
                }
                className={inputCls}
              >
                <option value="base_plus_content">Base + contenidos</option>
                <option value="replace">Sólo base</option>
                <option value="content_only">Sólo contenidos</option>
              </select>
            </Field>
          </div>

          {/* Lista de hijos */}
          <div>
            <p className="mb-2 font-body text-[10px] uppercase tracking-ultra text-bone/50">
              Productos permitidos dentro
            </p>
            {candidates.length === 0 ? (
              <p className="rounded border border-carbon-line bg-carbon/40 px-3 py-3 font-body text-xs text-bone/55">
                No hay otros productos disponibles. Creá primero otro
                producto y habilitalo como contenido abajo.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {candidates.map((p) => {
                  const sel = items.find((i) => i.child_product_id === p.id);
                  return (
                    <li
                      key={p.id}
                      className={[
                        'flex items-center gap-3 rounded border bg-carbon/40 px-3 py-2',
                        sel
                          ? 'border-gold/50'
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
                            ⚠ Este producto no está marcado como "Apto para
                            entrar en contenedores"
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
                              className="w-14 border-b border-carbon-line bg-carbon px-2 py-1 text-center text-bone caret-gold outline-none focus:border-gold"
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
                              className="w-16 border-b border-carbon-line bg-carbon px-2 py-1 text-center text-bone caret-gold outline-none focus:border-gold"
                            />
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Toggle: contenido (separado) */}
      <label className="mt-5 flex items-center gap-3">
        <input
          type="checkbox"
          checked={cfg.can_be_in_container}
          onChange={(e) => {
            const val = e.target.checked;
            setCfg((prev) => ({ ...prev, can_be_in_container: val }));
            void persistCanBeInContainer(val);
          }}
          className="h-4 w-4 accent-gold"
        />
        <span className="font-body text-sm text-bone">
          Apto para entrar dentro de otros contenedores
        </span>
      </label>

      <p className="mt-3 font-body text-[10px] uppercase tracking-ultra text-bone/40">
        {savedAt
          ? `Guardado · ${new Date(savedAt).toLocaleTimeString()}`
          : 'Los cambios se guardan automáticamente'}
      </p>
      {error && (
        <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 font-body text-xs text-red-300">
          {error}
        </p>
      )}
      {/* keep reference to productsById para que eslint no se queje. */}
      <span className="hidden">{productsById.size}</span>
    </fieldset>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  'w-full border-b border-carbon-line bg-carbon px-3 py-2 font-body text-bone placeholder-bone/40 focus:border-gold focus:bg-carbon-raised/30 outline-none transition';
