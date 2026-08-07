'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertEvent,
  deleteEvent,
  moveEvent,
} from '@/lib/admin-actions';
import type { BarloventoEvent } from '@/lib/queries';
import ImageDropzone from './ImageDropzone';

const empty = {
  title: '',
  date: '',
  location: '',
  description: '',
  image: '',
  kind: 'upcoming' as 'upcoming' | 'past',
};

export default function EventosTable({ events }: { events: BarloventoEvent[] }) {
  const router = useRouter();
  const [list, setList] = useState(events);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const onEdit = (e: BarloventoEvent) => {
    setEditing(e.id);
    setDraft({
      title: e.title,
      date: e.date,
      location: e.location,
      description: e.description,
      image: e.image,
      kind: e.kind,
    });
  };

  const onCancel = () => {
    setEditing(null);
    setDraft(empty);
    setFile(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !draft.image) {
      setError('Subí una imagen para el evento.');
      return;
    }
    setBusy(true);
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        if (editing) fd.append('id', String(editing));
        fd.append('title', draft.title);
        fd.append('date', draft.date);
        fd.append('location', draft.location);
        fd.append('description', draft.description);
        fd.append('image', draft.image);
        fd.append('kind', draft.kind);
        if (file) fd.append('imageFile', file);
        const saved = await upsertEvent(fd);
        setList((prev) => {
          const idx = prev.findIndex((p) => p.id === saved.id);
          if (idx === -1) return [saved, ...prev];
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        });
        onCancel();
        setBusy(false);
      } catch (err: any) {
        setError(err.message ?? 'Error al guardar.');
        setBusy(false);
      }
    });
  };

  const onDelete = (id: number) => {
    if (!confirm('¿Borrar este evento?')) return;
    startTransition(async () => {
      setList((prev) => prev.filter((e) => e.id !== id));
      await deleteEvent(id);
    });
  };

  const onMove = (e: BarloventoEvent, dir: -1 | 1) => {
    setBusyId(e.id);
    startTransition(async () => {
      try {
        await moveEvent(e.id, dir);
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
        <h1 className="font-display text-3xl text-bone">Eventos</h1>
        <p className="mt-1 font-body text-sm text-bone/60">
          {list.filter((e) => e.kind === 'upcoming').length} próximos ·{' '}
          {list.filter((e) => e.kind === 'past').length} en archivo.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="mb-10 space-y-4 border border-carbon-line bg-carbon p-4 sm:p-6"
      >
        <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
          {editing ? 'Editar evento' : 'Nuevo evento'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            placeholder="Título"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            required
            className="border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
          />
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            required
            className="border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
          />
          <input
            placeholder="Lugar"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            required
            className="border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
          />
          <select
            value={draft.kind}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as 'upcoming' | 'past' })
            }
            className="border-b border-carbon-line bg-carbon px-2 py-2 font-body text-bone focus:border-gold outline-none"
          >
            <option value="upcoming">Próximo</option>
            <option value="past">Archivo</option>
          </select>
          <div className="sm:col-span-2">
            <ImageDropzone
              file={file}
              onFile={setFile}
              previewUrl={draft.image || undefined}
              label="Imagen del evento"
              aspect="video"
            />
          </div>
          <textarea
            placeholder="Descripción"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            required
            rows={3}
            className="sm:col-span-2 border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-gold px-6 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear evento'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={onCancel}
              className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone"
            >
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="font-body text-sm text-red-400">{error}</p>}
      </form>

      <div className="overflow-x-auto border border-carbon-line bg-carbon">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-carbon-line text-bone/50 font-body text-[10px] uppercase tracking-ultra">
              <th className="w-12 p-3"></th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Título</th>
              <th className="p-3">Lugar</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => (
              <tr
                key={e.id}
                className={[
                  'border-b border-carbon-line/40 last:border-0',
                  busyId === e.id ? 'opacity-50' : '',
                ].join(' ')}
              >
                <td className="p-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => onMove(e, -1)}
                      disabled={i === 0}
                      className="text-bone/50 hover:text-gold disabled:opacity-30"
                      aria-label="Subir"
                    >▲</button>
                    <button
                      onClick={() => onMove(e, 1)}
                      disabled={i === list.length - 1}
                      className="text-bone/50 hover:text-gold disabled:opacity-30"
                      aria-label="Bajar"
                    >▼</button>
                  </div>
                </td>
                <td className="p-3 font-body text-sm text-bone/80">{e.date}</td>
                <td className="p-3 font-body text-sm text-bone">{e.title}</td>
                <td className="p-3 font-body text-sm text-bone/70">{e.location}</td>
                <td className="p-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
                      e.kind === 'upcoming'
                        ? 'bg-gold/20 text-gold'
                        : 'bg-carbon-line text-bone/50',
                    ].join(' ')}
                  >
                    {e.kind}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(e)}
                      className="rounded-full border border-gold/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-gold hover:bg-gold hover:text-carbon transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(e.id)}
                      className="rounded-full border border-red-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-red-400 hover:bg-red-500/20 transition"
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-bone/50 font-body text-sm">
                  Sin eventos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}