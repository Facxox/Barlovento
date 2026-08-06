'use client';

import { useState, useTransition } from 'react';
import {
  upsertGalleryItem,
  deleteGalleryItem,
} from '@/lib/admin-actions';
import type { GalleryItem } from '@/lib/queries';
import ImageDropzone from './ImageDropzone';

const CATEGORIES: Array<GalleryItem['category']> = [
  'elaboracion',
  'producto',
  'ferias',
];

export default function GaleriaGrid({ items }: { items: GalleryItem[] }) {
  const [list, setList] = useState(items);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GalleryItem['category']>('elaboracion');
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
            onChange={(e) => setCategory(e.target.value as GalleryItem['category'])}
            className="mt-2 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
        {list.map((g) => (
          <div key={g.id} className="group relative overflow-hidden border border-carbon-line bg-carbon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.image} alt={g.title} className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="font-body text-sm text-bone">{g.title}</p>
                <p className="font-body text-[10px] uppercase tracking-ultra text-gold/80">
                  {g.category}
                </p>
              </div>
              <button
                onClick={() => onDelete(g.id)}
                className="rounded-full border border-red-500/40 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-red-400 hover:bg-red-500/20 transition"
              >
                Borrar
              </button>
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