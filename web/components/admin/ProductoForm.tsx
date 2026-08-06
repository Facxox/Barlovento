'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertProduct,
  upsertWholesaleProduct,
} from '@/lib/admin-actions';
import type { Product, WholesaleProduct } from '@/lib/queries';
import ImageDropzone from './ImageDropzone';

type Mode = 'create' | 'edit';
type Variant = 'retail' | 'wholesale';

export default function ProductoForm({
  mode,
  initial,
  variant = 'retail',
}: {
  mode: Mode;
  initial?: Product | WholesaleProduct;
  variant?: Variant;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isWholesale = variant === 'wholesale';

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price.toString() ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'UYU');
  const [category, setCategory] = useState(initial?.category ?? 'clasicos');
  const [existingImage, setExistingImage] = useState<string>(
    initial?.image ?? '/Assets/placeholder.png'
  );
  const [badge, setBadge] = useState(initial?.badge ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sort_order?.toString() ?? '99');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    startTransition(async () => {
      try {
        const fd = new FormData();
        if (initial?.id) fd.append('id', initial.id);
        fd.append('name', name);
        fd.append('description', description);
        fd.append('price', price);
        fd.append('currency', currency);
        fd.append('category', category);
        fd.append('image', existingImage);
        fd.append('badge', badge);
        fd.append('is_active', String(isActive));
        fd.append('sort_order', sortOrder);
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
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Categoría">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            >
              <option value="clasicos">Clásicos</option>
              <option value="chocolate">Chocolate</option>
              <option value="especiales">Especiales</option>
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
        </div>

        <aside className="space-y-3">
          <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
            Vista previa
          </p>
          <div className="aspect-square overflow-hidden border border-carbon-line bg-carbon-raised">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {(file || existingImage !== '/Assets/placeholder.png') ? (
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

const inputCls =
  'w-full border-b border-carbon-line bg-transparent px-3 py-3 font-body text-bone placeholder-bone/40 focus:border-gold focus:bg-carbon-raised/30 outline-none transition';

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
