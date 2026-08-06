'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertCategory,
  deleteCategory,
  toggleCategoryActive,
} from '@/lib/admin-actions';
import type { Category } from '@/lib/queries';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export default function CategoriasTable({ items }: { items: Category[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ id: '', label: '', sort_order: '0', is_active: true });

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  const onSaveNew = () => {
    setError(null);
    setBusyId('new');
    const fd = new FormData();
    const id = (draft.id || slugify(draft.label)).trim();
    fd.append('id', id);
    fd.append('label', draft.label.trim());
    fd.append('sort_order', draft.sort_order);
    fd.append('is_active', String(draft.is_active));
    startTransition(async () => {
      try {
        await upsertCategory(fd);
        setShowNew(false);
        setDraft({ id: '', label: '', sort_order: '0', is_active: true });
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? 'No pudimos crear la categoría.');
      } finally {
        setBusyId(null);
      }
    });
  };

  const onSaveEdit = (cat: Category, label: string, sort: string, active: boolean) => {
    setError(null);
    setBusyId(cat.id);
    const fd = new FormData();
    fd.append('id', cat.id);
    fd.append('label', label.trim());
    fd.append('sort_order', sort);
    fd.append('is_active', String(active));
    startTransition(async () => {
      try {
        await upsertCategory(fd);
        setEditing(null);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? 'No pudimos guardar.');
      } finally {
        setBusyId(null);
      }
    });
  };

  const onDelete = (id: string) => {
    if (!confirm(`¿Eliminar la categoría "${id}"? Si hay productos con esta categoría, el borrado será bloqueado.`)) return;
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await deleteCategory(id);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? 'No pudimos borrar.');
      } finally {
        setBusyId(null);
      }
    });
  };

  const onToggleActive = (cat: Category) => {
    setBusyId(cat.id);
    startTransition(async () => {
      try {
        await toggleCategoryActive(cat.id, !cat.is_active);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? 'No pudimos cambiar el estado.');
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-bone">Categorías</h1>
          <p className="mt-1 font-body text-sm text-bone/60">
            {sorted.length} en total. Editá los nombres, el orden o el estado.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-full bg-gold px-5 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
        >
          + Nueva categoría
        </button>
      </header>

      {error && (
        <p className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">
          {error}
        </p>
      )}

      {showNew && (
        <div className="mb-4 border border-carbon-line bg-carbon p-5">
          <p className="mb-3 font-body text-[10px] uppercase tracking-ultra text-gold">
            Nueva categoría
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                Slug (opcional — se genera del nombre)
              </span>
              <input
                value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                placeholder="frutos-rojos"
                className="mt-1 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
              />
            </label>
            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                Nombre
              </span>
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Frutos rojos"
                className="mt-1 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
              />
            </label>
            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                Orden
              </span>
              <input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
                className="mt-1 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
              />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                className="h-4 w-4 accent-gold"
              />
              <span className="font-body text-sm text-bone">Activa</span>
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={onSaveNew}
              disabled={busyId === 'new'}
              className="rounded-full bg-gold px-5 py-2 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
            >
              {busyId === 'new' ? 'Creando…' : 'Crear'}
            </button>
            <button
              onClick={() => {
                setShowNew(false);
                setDraft({ id: '', label: '', sort_order: '0', is_active: true });
                setError(null);
              }}
              className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="p-3">Slug</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Orden</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const isEditing = editing === c.id;
              return isEditing ? (
                <EditRow
                  key={c.id}
                  cat={c}
                  busy={busyId === c.id}
                  onCancel={() => setEditing(null)}
                  onSave={(label, sort, active) => onSaveEdit(c, label, sort, active)}
                />
              ) : (
                <tr
                  key={c.id}
                  className={[
                    'border-b border-carbon-line/40 last:border-0 transition',
                    busyId === c.id ? 'opacity-50' : '',
                    !c.is_active ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <td className="p-3 font-body text-sm text-bone/70">{c.id}</td>
                  <td className="p-3 font-display text-base text-bone">{c.label}</td>
                  <td className="p-3 font-body text-sm text-bone/70">{c.sort_order}</td>
                  <td className="p-3">
                    <button
                      onClick={() => onToggleActive(c)}
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                        c.is_active
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-carbon-line text-bone/50',
                      ].join(' ')}
                    >
                      {c.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing(c.id)}
                        className="rounded-full border border-gold/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-gold hover:bg-gold hover:text-carbon transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="rounded-full border border-red-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-red-400 hover:bg-red-500/20 transition"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-bone/50 font-body text-sm">
                  No hay categorías todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRow({
  cat,
  busy,
  onCancel,
  onSave,
}: {
  cat: Category;
  busy: boolean;
  onCancel: () => void;
  onSave: (label: string, sort: string, active: boolean) => void;
}) {
  const [label, setLabel] = useState(cat.label);
  const [sort, setSort] = useState(String(cat.sort_order));
  const [active, setActive] = useState(cat.is_active);
  return (
    <tr className="border-b border-carbon-line/40 bg-carbon-raised/50">
      <td className="p-3 font-body text-sm text-bone/50">{cat.id}</td>
      <td className="p-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full border-b border-carbon-line bg-transparent px-2 py-1 font-body text-bone focus:border-gold outline-none"
        />
      </td>
      <td className="p-3">
        <input
          type="number"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-full border-b border-carbon-line bg-transparent px-2 py-1 font-body text-bone focus:border-gold outline-none"
        />
      </td>
      <td className="p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          <span className="font-body text-xs text-bone">Activa</span>
        </label>
      </td>
      <td className="p-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onSave(label, sort, active)}
            disabled={busy}
            className="rounded-full bg-gold px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={onCancel}
            className="font-body text-[11px] uppercase tracking-ultra text-bone/60 hover:text-bone"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}
