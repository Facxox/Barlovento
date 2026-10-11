'use client';

import { useState, useTransition, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  upsertProduct,
  upsertWholesaleProduct,
} from '@/lib/admin-actions';
import type { Product, WholesaleProduct, Category, Nutrition } from '@/lib/queries';
import ImageDropzone from './ImageDropzone';

// Componentes pesados (galería + container config) van lazy. Mantiene
// el bundle inicial del form chico; ambos sólo se montan en modo edit.
const ProductGalleryManagerLazy = dynamic(
  () => import('./ProductGalleryManager'),
  { ssr: false }
);
const ContainerConfigManagerLazy = dynamic(
  () => import('./ContainerConfigManager'),
  { ssr: false }
);

/**
 * Llamada al endpoint que crea un producto vacío como "ancla" para
 * la galería antes de que el admin termine el form. Devuelve el id
 * `tmp_*` que luego será reemplazado por el slug real al hacer el
 * submit final.
 */
async function createDraftProductId(): Promise<string> {
  const res = await fetch('/api/admin/products/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const json = (await res.json()) as { ok: boolean; productId?: string; error?: string };
  if (!res.ok || !json.ok || !json.productId) {
    throw new Error(json.error ?? 'preview_failed');
  }
  return json.productId;
}

/**
 * Sube archivos sueltos a un producto ya existente. Usado en el submit
 * final: si el admin tenía archivos "pendientes" (los subió antes de
 * que el producto existiera), van acá.
 */
async function uploadPendingTo(
  productId: string,
  files: File[]
): Promise<void> {
  if (files.length === 0) return;
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const res = await fetch(
    `/api/admin/products/${encodeURIComponent(productId)}/images`,
    { method: 'POST', body: fd }
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `upload_failed:${res.status}`);
  }
}

type Mode = 'create' | 'edit';
type Variant = 'retail' | 'wholesale';

export default function ProductoForm({
  mode,
  initial,
  variant = 'retail',
  categories,
}: {
  mode: Mode;
  initial?: Product | WholesaleProduct;
  variant?: Variant;
  categories: Category[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isWholesale = variant === 'wholesale';

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price.toString() ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'UYU');
  const [category, setCategory] = useState(initial?.category ?? categories[0]?.id ?? '');
  const [existingImage, setExistingImage] = useState<string>(
    initial?.image ?? ''
  );
  const [badge, setBadge] = useState(initial?.badge ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [file, setFile] = useState<File | null>(null);
  // Cuántos alfajores trae cada unidad (1 = suelto, 12 = caja de 12). Lo
  // multiplicamos por la cantidad del carrito en el checkout para calcular
  // el envío fijo ($195 / $220 según el total de alfajores).
  const [unitsPerPack, setUnitsPerPack] = useState(
    initial?.units_per_pack?.toString() ?? '1'
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Información nutricional (opcional). Estructura tipo packaging.
  const [nutrition, setNutrition] = useState<Nutrition>(
    initial?.nutrition ?? {
      portion: '',
      servings_per_package: null,
      rows: [],
    }
  );
  const [nutritionEnabled, setNutritionEnabled] = useState<boolean>(
    !!initial?.nutrition
  );

  /**
   * Galería en modo create: como el producto todavía no existe en DB,
   * creamos un "draft" (id `tmp_*`) apenas el admin agrega la primera
   * foto. Las fotos suben asociadas a ese id temporal, y el submit
   * final migra a `upsertProduct` con el id que ya quedó vinculado a
   * la galería. Si el admin nunca toca la galería, no creamos draft
   * (evita filas huérfanas en `products`).
   */
  const [draftProductId, setDraftProductId] = useState<string | null>(
    initial?.id && initial.id.startsWith('tmp_') ? initial.id : null
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    startTransition(async () => {
      try {
        const fd = new FormData();
        // Si estamos en modo create y el admin ya subió fotos de la
        // galería, las fotos viven bajo `draftProductId` (tmp_*). El
        // upsert recibe ese id — el server hace un upsert con ese id
        // exacto (no se renombra en create), preservando todas las
        // fotos asociadas vía FK.
        if (initial?.id) {
          fd.append('id', initial.id);
        } else if (draftProductId) {
          fd.append('id', draftProductId);
        }
        fd.append('name', name);
        fd.append('description', description);
        fd.append('price', price);
        fd.append('currency', currency);
        fd.append('category', category);
        fd.append('image', existingImage);
        fd.append('badge', badge);
        fd.append('is_active', String(isActive));
        // sort_order lo gestiona el admin desde la lista con flechas;
        // dejamos el server action calcularlo al final de la lista si es
        // un producto nuevo.
        fd.append('sort_order', initial?.sort_order?.toString() ?? '9999');
        fd.append('units_per_pack', unitsPerPack);
        // Información nutricional: serializamos a JSON. Si el toggle está
        // apagado mandamos string vacío para que el server guarde NULL.
        fd.append(
          'nutrition_json',
          nutritionEnabled
            ? JSON.stringify({
                portion: nutrition.portion.trim(),
                servings_per_package: nutrition.servings_per_package,
                rows: nutrition.rows,
                // Bloque extendido (octógonos / packaging). Se reenvía tal
                // cual desde initial para que un edit no pierda datos.
                kcal: nutrition.kcal ?? null,
                kj: nutrition.kj ?? null,
                carbs_g: nutrition.carbs_g ?? null,
                protein_g: nutrition.protein_g ?? null,
                fat_g: nutrition.fat_g ?? null,
                saturated_g: nutrition.saturated_g ?? null,
                fiber_g: nutrition.fiber_g ?? null,
                sodium_mg: nutrition.sodium_mg ?? null,
                trans_g: nutrition.trans_g ?? null,
                warning_labels: nutrition.warning_labels ?? [],
              })
            : ''
        );
        if (file) fd.append('imageFile', file);
        if (isWholesale) {
          await upsertWholesaleProduct(fd);
        } else {
          await upsertProduct(fd);
        }
        router.push(
          isWholesale
            ? '/admin/productos?type=wholesale'
            : '/admin/productos'
        );
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? 'Error al guardar.');
        setSaving(false);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          {isWholesale && (
            <p className="mb-2 inline-block rounded-full border border-gold/40 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-gold">
              Producto mayorista
            </p>
          )}
          <h1 className="font-display text-3xl text-bone">
            {mode === 'create'
              ? isWholesale
                ? 'Nuevo producto mayorista'
                : 'Nuevo producto'
              : `Editar: ${initial?.name}`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() =>
            router.push(
              isWholesale
                ? '/admin/productos?type=wholesale'
                : '/admin/productos'
            )
          }
          className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone"
        >
          ← Volver
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Field label="Nombre">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={isWholesale ? 'Precio mayorista' : 'Precio'}>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="Moneda">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputCls}
              >
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Orden">
              <p className="mt-2 font-body text-xs text-bone/60">
                Editá el orden desde la lista de productos con las flechas ▲▼.
              </p>
            </Field>
          </div>

          {/* Empaque — cuántos alfajores trae cada unidad del producto.
              Define el envío en el checkout: ≤20 alfajores = $195,
              >20 = $220. */}
          <fieldset className="border border-carbon-line bg-carbon-raised/40 p-5">
            <legend className="px-2 font-body text-[10px] uppercase tracking-ultra text-gold">
              Empaque
            </legend>

            <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
              {/* Toggle Suelto / Caja */}
              <div>
                <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                  Tipo de unidad
                </p>
                <div className="mt-2 inline-flex rounded-full border border-carbon-line bg-carbon p-1">
                  <button
                    type="button"
                    onClick={() => setUnitsPerPack('1')}
                    aria-pressed={unitsPerPack === '1'}
                    className={[
                      'rounded-full px-5 py-2 font-body text-xs uppercase tracking-ultra transition',
                      unitsPerPack === '1'
                        ? 'bg-gold text-carbon shadow-[0_0_0_1px_rgba(212,175,55,0.4)]'
                        : 'text-bone/60 hover:text-bone',
                    ].join(' ')}
                  >
                    Suelto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Si está en "Suelto" y eligen "Caja", sugerimos 12
                      // como valor inicial. Si ya tenía >1, lo respetamos.
                      if (unitsPerPack === '1') setUnitsPerPack('12');
                    }}
                    aria-pressed={unitsPerPack !== '1'}
                    className={[
                      'rounded-full px-5 py-2 font-body text-xs uppercase tracking-ultra transition',
                      unitsPerPack !== '1'
                        ? 'bg-gold text-carbon shadow-[0_0_0_1px_rgba(212,175,55,0.4)]'
                        : 'text-bone/60 hover:text-bone',
                    ].join(' ')}
                  >
                    Caja
                  </button>
                </div>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-bone/55">
                  {unitsPerPack === '1'
                    ? 'Vendés el producto por unidad (1 alfajor = 1 envío).'
                    : 'Vendés el producto en una caja. Indicá cuántos alfajores trae cada una.'}
                </p>
              </div>

              {/* Cantidad por unidad — visible solo si es Caja */}
              <div className={unitsPerPack === '1' ? 'sm:opacity-30 sm:pointer-events-none' : ''}>
                <label
                  htmlFor="units_per_pack"
                  className="block font-body text-[10px] uppercase tracking-ultra text-bone/50"
                >
                  Alfajores por unidad
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setUnitsPerPack(
                        String(Math.max(2, Number(unitsPerPack || 1) - 1))
                      )
                    }
                    aria-label="Restar uno"
                    disabled={unitsPerPack === '1'}
                    className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-gold transition hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:border-carbon-line disabled:text-bone/30 disabled:hover:bg-transparent"
                  >
                    −
                  </button>
                  <input
                    id="units_per_pack"
                    name="units_per_pack"
                    type="number"
                    min="1"
                    step="1"
                    value={unitsPerPack}
                    onChange={(e) => setUnitsPerPack(e.target.value)}
                    required
                    className="w-20 border-b border-carbon-line bg-carbon px-3 py-2 text-center font-display text-2xl text-gold caret-gold outline-none transition focus:border-gold focus:bg-carbon-raised/30"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setUnitsPerPack(String(Number(unitsPerPack || 1) + 1))
                    }
                    aria-label="Sumar uno"
                    className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-gold transition hover:border-gold hover:bg-gold/10"
                  >
                    +
                  </button>
                </div>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-bone/55">
                  Si es una caja, indicá cuántos alfajores trae. Si es un
                  alfajor suelto, dejá 1.
                </p>
              </div>
            </div>

            {/* Preview del impacto en el envío */}
            <PackPreview unitsPerPack={unitsPerPack} />
          </fieldset>

          <Field label="Categoría">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            >
              {categories.length === 0 && <option value="">— sin categorías —</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.is_active ? '' : ' (inactiva)'}
                </option>
              ))}
              {/* Si el producto actual tiene una categoría que ya no existe
                  (borrada de la lista), la mantenemos visible para no perderla. */}
              {initial && !categories.some((c) => c.id === initial.category) && (
                <option value={initial.category}>{initial.category} (huérfana)</option>
              )}
            </select>
          </Field>

          <Field label="Badge (opcional)">
            <input
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="Ej: Edición limitada"
              className={inputCls}
            />
          </Field>

          {/* Información nutricional — opcional, estilo etiqueta */}
          <fieldset className="border border-carbon-line bg-carbon-raised/40 p-5">
            <legend className="px-2 font-body text-[10px] uppercase tracking-ultra text-gold">
              Información nutricional
            </legend>

            <label className="mb-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={nutritionEnabled}
                onChange={(e) => setNutritionEnabled(e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              <span className="font-body text-sm text-bone">
                Mostrar tabla nutricional en la tienda
              </span>
            </label>

            {nutritionEnabled && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Porción">
                    <input
                      value={nutrition.portion}
                      onChange={(e) =>
                        setNutrition({ ...nutrition, portion: e.target.value })
                      }
                      placeholder="Ej: 1 alfajor (40 g)"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Porciones por envase (opcional)">
                    <input
                      type="number"
                      value={nutrition.servings_per_package ?? ''}
                      onChange={(e) =>
                        setNutrition({
                          ...nutrition,
                          servings_per_package:
                            e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      placeholder="Ej: 12"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div>
                  <p className="mb-2 font-body text-[10px] uppercase tracking-ultra text-bone/50">
                    Nutrientes
                  </p>
          <div className="grid gap-2 overflow-x-auto">
                    <div className="grid min-w-[420px] grid-cols-[minmax(140px,1fr)_minmax(100px,140px)_minmax(55px,80px)_40px] gap-2 font-body text-[10px] uppercase tracking-ultra text-bone/40">
                      <span>Nombre</span>
                      <span>Cantidad</span>
                      <span>% VD</span>
                      <span></span>
                    </div>
                    {nutrition.rows.map((row, i) => (
                      <div
                        key={i}
                        className="grid min-w-[420px] grid-cols-[minmax(140px,1fr)_minmax(100px,140px)_minmax(55px,80px)_40px] gap-2"
                      >
                        <input
                          value={row.nutrient}
                          onChange={(e) => {
                            const next = [...nutrition.rows];
                            next[i] = { ...row, nutrient: e.target.value };
                            setNutrition({ ...nutrition, rows: next });
                          }}
                          placeholder="Valor energético"
                          className={inputCls}
                        />
                        <input
                          value={row.amount}
                          onChange={(e) => {
                            const next = [...nutrition.rows];
                            next[i] = { ...row, amount: e.target.value };
                            setNutrition({ ...nutrition, rows: next });
                          }}
                          placeholder="180 kcal"
                          className={inputCls}
                        />
                        <input
                          value={row.dv}
                          onChange={(e) => {
                            const next = [...nutrition.rows];
                            next[i] = { ...row, dv: e.target.value };
                            setNutrition({ ...nutrition, rows: next });
                          }}
                          placeholder="9%"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNutrition({
                              ...nutrition,
                              rows: nutrition.rows.filter((_, idx) => idx !== i),
                            })
                          }
                          className="font-body text-[10px] uppercase tracking-ultra text-bone/40 hover:text-red-400"
                          aria-label={`Quitar fila ${i + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setNutrition({
                          ...nutrition,
                          rows: [
                            ...nutrition.rows,
                            { nutrient: '', amount: '', dv: '' },
                          ],
                        })
                      }
                      className="self-start font-body text-[10px] uppercase tracking-ultra text-gold hover:text-gold-light"
                    >
                      + Agregar nutriente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          <ImageDropzone
            file={file}
            onFile={setFile}
            previewUrl={existingImage}
          />

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            <span className="font-body text-sm text-bone">Visible en el sitio</span>
          </label>

          {/* Galería múltiple — funciona en AMBOS modos. En edit usa el
              id del producto existente. En create, si todavía no hay
              draftProductId, mostramos un placeholder que crea el draft
              cuando el admin hace click en "Activar galería". */}
          {!isWholesale && (
            <GallerySection
              mode={mode}
              productId={initial?.id && !initial.id.startsWith('tmp_') ? initial.id : null}
              draftProductId={draftProductId}
              initialImages={
                (initial as unknown as {
                  galleryImages?: import('@/lib/gallery').ProductImage[];
                }).galleryImages ?? []
              }
              onDraftCreated={setDraftProductId}
            />
          )}

          {/* Config de contenedor — sólo retail por ahora, igual que el
              configurador del storefront. */}
          {!isWholesale && mode === 'edit' && initial?.id && (
            <ContainerConfigManagerLazy
              productId={initial.id}
              initial={{
                is_container: !!(initial as unknown as { is_container?: boolean }).is_container,
                container_base_price: (initial as unknown as { container_base_price?: number | null }).container_base_price ?? null,
                price_mode: ((initial as unknown as { price_mode?: 'replace' | 'base_plus_content' | 'content_only' }).price_mode ?? 'base_plus_content'),
                container_capacity: (initial as unknown as { container_capacity?: number | null }).container_capacity ?? null,
                container_min_units: (initial as unknown as { container_min_units?: number }).container_min_units ?? 1,
                container_max_units: (initial as unknown as { container_max_units?: number | null }).container_max_units ?? null,
                container_require_full: !!(initial as unknown as { container_require_full?: boolean }).container_require_full,
                can_be_in_container: !!(initial as unknown as { can_be_in_container?: boolean }).can_be_in_container,
              }}
              availableProducts={(initial as unknown as { availableProducts?: Array<{ id: string; name: string; image: string | null; can_be_in_container: boolean }> }).availableProducts ?? []}
              initialContainerItems={(initial as unknown as { containerItems?: import('@/lib/admin-product-extras').ContainerItemInput[] }).containerItems ?? []}
            />
          )}
        </div>

        <aside className="space-y-3">
          <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
            Vista previa
          </p>
          <div className="aspect-square overflow-hidden border border-carbon-line bg-carbon-raised">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {(file || existingImage) ? (
              <img
                src={file ? URL.createObjectURL(file) : existingImage}
                alt={name || 'preview'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-bone/40 font-body text-xs">
                Sin imagen
              </div>
            )}
          </div>
          <p className="font-body text-xs text-bone/60">{name || '—'}</p>
          <p className="font-display text-2xl text-gold">
            {price ? `${currency} ${Number(price).toFixed(0)}` : '—'}
          </p>
        </aside>
      </div>

      {error && <p className="font-body text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3 border-t border-carbon-line pt-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-gold px-6 py-3 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
        >
          {saving ? 'Guardando…' : mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() =>
            router.push(
              isWholesale
                ? '/admin/productos?type=wholesale'
                : '/admin/productos'
            )
          }
          className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Sección de galería que maneja AMBOS modos (create / edit):
 *
 * - edit: usa el id real del producto.
 * - create: si todavía no hay draft, el botón "Activar galería" crea
 *   un producto placeholder (id `tmp_*`) en DB vía REST. Esto es
 *   necesario porque la FK `product_images.product_id` exige un
 *   producto existente; no podemos diferir la creación hasta el
 *   submit final porque la galería debe ser usable ANTES del submit
 *   (la persona sube sus fotos antes de terminar de cargar el form).
 *
 * Si el admin sube fotos y después abandona el form sin guardar, el
 * producto `tmp_*` queda en DB — tiene is_active=false así que no
 * aparece en el storefront, y se puede limpiar vía una query SQL
 * (no prioritario para esta feature).
 */
function GallerySection({
  mode,
  productId,
  draftProductId,
  initialImages,
  onDraftCreated,
}: {
  mode: Mode;
  productId: string | null;
  draftProductId: string | null;
  initialImages: import('@/lib/gallery').ProductImage[];
  onDraftCreated: (id: string) => void;
}) {
  const [activated, setActivated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function activate() {
    setErr(null);
    setCreating(true);
    try {
      const id = await createDraftProductId();
      onDraftCreated(id);
      setActivated(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'preview_failed');
    } finally {
      setCreating(false);
    }
  }

  // En edit siempre está activado.
  const activeId = mode === 'edit' ? productId : draftProductId;
  const isReady = mode === 'edit' || activated;

  return (
    <fieldset className="border border-carbon-line bg-carbon-raised/40 p-5">
      <legend className="px-2 font-body text-[10px] uppercase tracking-ultra text-gold">
        Galería de imágenes
      </legend>

      {!isReady ? (
        <div className="space-y-2">
          <p className="font-body text-[11px] leading-relaxed text-bone/55">
            La galería se guarda por foto subida. Necesitamos crear un
            producto borrador como ancla para asociar las imágenes. Al
            confirmar el producto al final del formulario, ese borrador
            se completa con los datos de este form.
          </p>
          <button
            type="button"
            onClick={activate}
            disabled={creating}
            className="rounded-full border border-gold/40 px-4 py-2 font-body text-[10px] uppercase tracking-ultra text-gold transition hover:bg-gold hover:text-carbon disabled:opacity-50"
          >
            {creating ? 'Creando borrador…' : 'Activar galería'}
          </button>
          {err && (
            <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 font-body text-xs text-red-300">
              {err}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-body text-[11px] leading-relaxed text-bone/55">
            {mode === 'create'
              ? 'Las fotos se asocian a un borrador invisible. Al guardar el producto, las fotos quedan vinculadas a la versión final.'
              : 'Podés seleccionar varias fotos a la vez desde el selector.'}
          </p>
          {/* Lazy load para evitar el bundle inicial del form */}
          <ProductGalleryManagerLazy
            productId={activeId as string}
            initialImages={initialImages}
          />
        </div>
      )}
    </fieldset>
  );
}

const inputCls =
  'w-full border-b border-carbon-line bg-carbon px-3 py-3 font-body text-bone placeholder-bone/40 focus:border-gold focus:bg-carbon-raised/30 outline-none transition';

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

// Misma regla de envío que en CheckoutForm y /api/checkout — la fuente
// de verdad vive acá para que el preview coincida con lo que el cliente
// verá al pagar. Sin inventar datos: el preview se calcula a partir del
// valor que el admin cargó.
function shippingFor(alfajores: number): number {
  if (alfajores <= 0) return 0;
  return alfajores > 20 ? 220 : 195;
}

/**
 * Preview del impacto en el envío según el valor que el admin acaba de
 * cargar. Solo lee `unitsPerPack` (lo que el admin tipeó) — no inventa
 * ejemplos. Muestra dos casos concretos: con 1 unidad del producto y
 * con 2 unidades, para que el admin vea dónde cae el umbral.
 */
function PackPreview({ unitsPerPack }: { unitsPerPack: string }) {
  const n = Math.max(1, Math.floor(Number(unitsPerPack) || 1));
  const a1 = n; // 1 unidad
  const a2 = n * 2; // 2 unidades
  const s1 = shippingFor(a1);
  const s2 = shippingFor(a2);

  const cases = [
    { unidades: 1, alfajores: a1, envio: s1 },
    { unidades: 2, alfajores: a2, envio: s2 },
  ];

  return (
    <div className="mt-5 border-t border-carbon-line pt-4">
      <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        Impacto en el envío
      </p>
      <p className="mt-1 font-body text-[11px] leading-relaxed text-bone/55">
        Con {n} alfajor{n === 1 ? '' : 'es'} por unidad, el envío se calcula así:
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {cases.map((c) => (
          <div
            key={c.unidades}
            className="rounded-md border border-carbon-line bg-carbon/60 px-3 py-2 font-body text-xs text-bone/80"
          >
            <div className="flex items-baseline justify-between">
              <span>
                {c.unidades} unidad{c.unidades === 1 ? '' : 'es'}
              </span>
              <span className="text-bone/55">
                {c.alfajores} alfajor{c.alfajores === 1 ? '' : 'es'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-bone/55">Envío</span>
              <span className="font-display text-lg text-gold">
                {c.envio === 0 ? '—' : `$${c.envio}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
