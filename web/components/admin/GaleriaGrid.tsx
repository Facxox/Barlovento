'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertGalleryItem,
  deleteGalleryItem,
  moveGalleryItem,
} from '@/lib/admin-actions';
import type { GalleryItem, GalleryCategory } from '@/lib/queries';
import ImageDropzone from './ImageDropzone';

export default function GaleriaGrid({
  items,
  categories,
}: {
  items: GalleryItem[];
  categories: GalleryCategory[];
}) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const defaultCategory = categories[0]?.id ?? 'elaboracion';
  const [category, setCategory] = useState<string>(defaultCategory);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Lista de slugs activos para el <select>. Si un item existente tiene
  // una categoría que ya no está en la lista (huérfana), la mostramos
  // igual para no perder la asignación visible.
  const activeIds = new Set(categories.filter((c) => c.is_active).map((c) => c.id));

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Elegí una imagen.');
      return;
    }
    setBusy(true);
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append('title', title);
        fd.append('category', category);
        fd.append('image', '');
        fd.append('sort_order', String(list.length + 1));
        fd.append('imageFile', file);
        const next = await upsertGalleryItem(fd);
        setList((prev) => [...prev, next]);
        setFile(null);
        setTitle('');
        setBusy(false);
      } catch (err: any) {
        setError(err.message ?? 'Error al subir.');
        setBusy(false);
      }
    });
  };

  const onDelete = (id: number) => {
    if (!confirm('¿Borrar esta imagen?')) return;
    startTransition(async () => {
      setList((prev) => prev.filter((g) => g.id !== id));
      await deleteGalleryItem(id);
    });
  };

  const onMove = (g: GalleryItem, dir: -1 | 1) => {
    setBusyId(g.id);
    startTransition(async () => {
      try {
        await moveGalleryItem(g.id, dir);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? 'No pudimos reordenar.');
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-bone">Galería</h1>
        <p className="mt-1 font-body text-sm text-bone/60">
          {list.length} imágenes publicadas.
        </p>
      </header>

      <form
        onSubmit={onAdd}
        className="mb-10 grid gap-4 border border-carbon-line bg-carbon p-6 sm:grid-cols-12"
      >
        <div className="sm:col-span-4">
          <ImageDropzone
            file={file}
            onFile={setFile}
            label="Imagen"
            aspect="video"
          />
        </div>
        <div className="sm:col-span-4">
          <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
            Título
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-2 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
            Categoría
          </p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
          >
            {categories
              .filter((c) => c.is_active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            {/* Orphan safekeeping: si la categoría actual del item no
                está en la lista (la borraron del admin), la mostramos
                igual para no perderla visualmente. */}
            {category && !activeIds.has(category) && (
              <option value={category}>
                {category} (huérfana)
              </option>
            )}
          </select>
        </div>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-gold px-4 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Subiendo…' : 'Subir'}
          </button>
        </div>
        {error && (
          <p className="font-body text-sm text-red-400 sm:col-span-12">{error}</p>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g, i) => (
          <div
            key={g.id}
            className={[
              'group relative overflow-hidden border border-carbon-line bg-carbon',
              busyId === g.id ? 'opacity-50' : '',
            ].join(' ')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.image} alt={g.title} className="block w-full h-auto" />
            <div className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="font-body text-sm text-bone">{g.title}</p>
                <p className="font-body text-[10px] uppercase tracking-ultra text-gold/80">
                  {g.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => onMove(g, -1)}
                    disabled={i === 0}
                    className="font-body text-[10px] leading-none text-bone/50 hover:text-gold disabled:opacity-30"
                    aria-label="Subir"
                  >▲</button>
                  <button
                    onClick={() => onMove(g, 1)}
                    disabled={i === list.length - 1}
                    className="font-body text-[10px] leading-none text-bone/50 hover:text-gold disabled:opacity-30"
                    aria-label="Bajar"
                  >▼</button>
                </div>
                <button
                  onClick={() => onDelete(g.id)}
                  className="rounded-full border border-red-500/40 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-red-400 hover:bg-red-500/20 transition"
                >
                  Borrar
                </button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="col-span-full p-8 text-center font-body text-sm text-bone/50 border border-carbon-line">
            Sin imágenes todavía.
          </p>
        )}
      </div>
    </div>
  );
}
