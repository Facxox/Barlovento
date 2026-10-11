'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  uploadProductImages,
  deleteProductImage,
  reorderProductImages,
  setProductPrimaryImage,
} from '@/lib/admin-product-extras';
import type { ProductImage } from '@/lib/gallery';

type Props = {
  productId: string;
  initialImages: ProductImage[];
};

/**
 * Manager de galería de imágenes para el formulario de producto.
 *
 * Funcionalidades:
 *   - Subir múltiples imágenes a la vez
 *   - Reordenar con flechas ▲▼
 *   - Marcar como principal
 *   - Eliminar (con confirmación)
 *   - Preview inmediato al subir
 *
 * Persistencia contra /admin/product-extras server actions. Service role
 * es el que escribe (las policies RLS sólo permiten authenticated).
 */
export default function ProductGalleryManager({
  productId,
  initialImages,
}: Props) {
  const [images, setImages] = useState<ProductImage[]>(
    [...initialImages].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar si el padre nos pasa nuevas imágenes (cambio de producto).
  useEffect(() => {
    setImages(
      [...initialImages].sort((a, b) => a.sort_order - b.sort_order)
    );
  }, [productId]);

  const onPick = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const fs = Array.from(e.target.files ?? []);
      if (fs.length === 0) return;
      setError(null);
      setUploading(true);
      // Empaquetamos los archivos en FormData (los server actions de
      // Next no aceptan File[] directamente — sólo FormData o tipos
      // JSON-serializables). Cada archivo va como un entry "files"
      // separado (FormData.getAll('files') los recupera).
      const fd = new FormData();
      fd.append('productId', productId);
      for (const f of fs) fd.append('files', f);
      const result = await uploadProductImages(fd);
      if (!result.ok) {
        setError(result.error);
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      // Optimistic append
      setImages((prev) => [...prev, ...result.rows]);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    },
    [productId]
  );

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return;
    const result = await deleteProductImage(id);
    if (!result.ok) {
      setError(result.error ?? 'delete_failed');
      return;
    }
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePrimary = async (id: number) => {
    const result = await setProductPrimaryImage(id);
    if (!result.ok) {
      setError(result.error ?? 'primary_failed');
      return;
    }
    setImages((prev) =>
      prev.map((i) => ({ ...i, is_primary: i.id === id }))
    );
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[idx];
    const b = next[target];
    next[idx] = b;
    next[target] = a;
    // Reasignar sort_order por posición.
    const reordered = next.map((img, i) => ({ ...img, sort_order: i }));
    setImages(reordered);
    const result = await reorderProductImages(reordered.map((i) => i.id));
    if (!result.ok) {
      setError(result.error ?? 'reorder_failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
          Galería ({images.length} foto{images.length === 1 ? '' : 's'})
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-gold/40 px-4 py-2 font-body text-[10px] uppercase tracking-ultra text-gold transition hover:bg-gold hover:text-carbon disabled:opacity-50"
        >
          {uploading ? 'Subiendo…' : '+ Agregar fotos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/avif"
          onChange={onPick}
          className="hidden"
        />
      </div>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 font-body text-xs text-red-300">
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <p className="rounded border border-carbon-line bg-carbon-raised/30 px-3 py-6 text-center font-body text-xs text-bone/50">
          Este producto todavía no tiene fotos en la galería. Subí alguna —
          la primera se marca como principal por defecto.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, idx) => (
            <li
              key={img.id}
              className="group relative overflow-hidden border border-carbon-line bg-carbon-raised"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="block aspect-square w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 flex flex-col justify-between bg-carbon/60 p-2 opacity-0 transition group-hover:opacity-100">
                <div className="flex items-center justify-between gap-1">
                  {img.is_primary ? (
                    <span className="rounded-full bg-gold px-2 py-0.5 font-body text-[9px] uppercase tracking-ultra text-carbon">
                      Principal
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePrimary(img.id)}
                      className="rounded-full border border-bone/40 px-2 py-0.5 font-body text-[9px] uppercase tracking-ultra text-bone hover:border-gold hover:text-gold"
                    >
                      Hacer principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-red-500/30 text-bone hover:bg-red-500/60"
                    aria-label={`Eliminar imagen ${idx + 1}`}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="grid h-7 w-7 place-items-center rounded-full bg-bone/20 text-bone hover:bg-bone/40 disabled:opacity-30"
                    aria-label="Subir"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === images.length - 1}
                    className="grid h-7 w-7 place-items-center rounded-full bg-bone/20 text-bone hover:bg-bone/40 disabled:opacity-30"
                    aria-label="Bajar"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
