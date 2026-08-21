'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertEvent,
  deleteEvent,
  moveEvent,
  addEventImage,
  removeEventImage,
  reorderEventImages,
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

type ImageRow = { id: number; url: string };

/**
 * Editor de múltiples imágenes para un evento ya guardado.
 * - La primera (position=0) es la portada.
 * - Permite subir, borrar y reordenar.
 *
 * Después de cada acción llama a `onChanged()` para que el padre
 * refresque la lista (router.refresh) y los ids queden en sync.
 */
function MultiImageEditor({
  eventId,
  initial,
  onChanged,
}: {
  eventId: number;
  initial: ImageRow[];
  onChanged: () => void;
}) {
  const [images, setImages] = useState<ImageRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const inserted = await addEventImage(eventId, file);
      setImages((prev) => [...prev, { id: inserted.id, url: inserted.url }]);
      onChanged();
    } catch (e: any) {
      setError(e.message ?? 'No pudimos subir la foto.');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (img: ImageRow) => {
    if (!confirm('¿Borrar esta foto?')) return;
    setBusy(true);
    setError(null);
    try {
      await removeEventImage(img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
      onChanged();
    } catch (e: any) {
      setError(e.message ?? 'No pudimos borrar la foto.');
    } finally {
      setBusy(false);
    }
  };

  const onMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setImages(next);
    setBusy(true);
    setError(null);
    try {
      await reorderEventImages(
        eventId,
        next.map((i) => i.id)
      );
      onChanged();
    } catch (e: any) {
      setError(e.message ?? 'No pudimos reordenar.');
    } finally {
      setBusy(false);
    }
  };

  if (images.length === 0) {
    return (
      <div className="space-y-2">
        <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
          Sin fotos. Subí la primera para crear la portada.
        </p>
        <SingleUploader onFile={onAdd} disabled={busy} label="Subir primera foto" />
        {error && <p className="font-body text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const cover = images[0];
  const rest = images.slice(1);

  return (
    <div className="space-y-4">
      <p className="font-body text-[10px] uppercase tracking-ultra text-gold">
        Portada
      </p>
      <div className="relative aspect-[16/10] w-full overflow-hidden border border-carbon-line bg-carbon-raised">
        <img src={cover.url} alt="" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => onRemove(cover)}
          disabled={busy}
          className="absolute right-2 top-2 rounded-full bg-carbon/80 px-2 py-1 font-body text-[10px] uppercase tracking-ultra text-red-300 hover:bg-red-500/30"
        >
          ✕ Quitar portada
        </button>
      </div>

      {rest.length > 0 && (
        <>
          <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
            Más fotos ({rest.length})
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {rest.map((img, idx) => {
              // idx en `images` es idx + 1 porque la portada está en 0.
              const realIdx = idx + 1;
              return (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden border border-carbon-line bg-carbon-raised"
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-1 top-1 flex justify-between">
                    <button
                      type="button"
                      onClick={() => onMove(realIdx, -1)}
                      disabled={busy}
                      className="rounded bg-carbon/80 px-1.5 py-0.5 font-body text-[10px] text-bone hover:bg-gold hover:text-carbon"
                      aria-label="Mover antes"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(realIdx, 1)}
                      disabled={busy}
                      className="rounded bg-carbon/80 px-1.5 py-0.5 font-body text-[10px] text-bone hover:bg-gold hover:text-carbon"
                      aria-label="Mover después"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(img)}
                    disabled={busy}
                    className="absolute bottom-1 right-1 rounded bg-carbon/80 px-1.5 py-0.5 font-body text-[10px] text-red-300 hover:bg-red-500/30"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <SingleUploader onFile={onAdd} disabled={busy} label="Agregar otra foto" />
      {error && <p className="font-body text-xs text-red-400">{error}</p>}
    </div>
  );
}

function SingleUploader({
  onFile,
  disabled,
  label,
}: {
  onFile: (f: File) => void | Promise<void>;
  disabled?: boolean;
  label: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div
      className={disabled ? 'pointer-events-none opacity-60' : ''}
      onClick={async () => {
        if (!file) return;
        await onFile(file);
        setFile(null);
      }}
    >
      <ImageDropzone
        file={file}
        onFile={setFile}
        label={label}
        aspect="video"
      />
      {file && (
        <p className="mt-2 font-body text-[11px] text-bone/60">
          Tocá fuera del recuadro para confirmar la subida.
        </p>
      )}
    </div>
  );
}

/**
 * Picker multi-archivo para arrastrar/elegir varias fotos a la vez.
 * Acumula `File[]` y muestra preview grid con botón ✕ individual.
 * La primera foto del array será la portada.
 */
function MiniMultiPicker({
  files,
  onChange,
  maxSizeMB = 8,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  maxSizeMB?: number;
}) {
  const [error, setError] = useState<string | null>(null);

  const ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif';
  const acceptList = ACCEPT.split(',');

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    const arr = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/') || !acceptList.includes(f.type)) {
        setError(`"${f.name}" no es una imagen soportada.`);
        continue;
      }
      const sizeMB = f.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setError(`"${f.name}" pesa ${sizeMB.toFixed(1)} MB (máx ${maxSizeMB} MB).`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) onChange([...files, ...accepted]);
  };

  const removeAt = (idx: number) => {
    const next = files.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    // Reset para permitir re-seleccionar el mismo archivo.
    e.target.value = '';
  };

  return (
    <div>
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="relative grid cursor-pointer place-items-center border-2 border-dashed border-carbon-line bg-carbon-raised/40 px-6 py-8 transition hover:border-gold/60 hover:bg-carbon-raised/60"
      >
        <div className="text-center">
          <p className="font-display text-xl text-bone/80">
            {files.length > 0
              ? 'Sumá más fotos'
              : 'Arrastrá una o varias fotos'}
          </p>
          <p className="mt-2 font-body text-xs text-bone/50">
            o hacé click para elegir · máx {maxSizeMB} MB c/u
          </p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-ultra text-bone/40">
            PNG · JPG · WEBP · AVIF
          </p>
        </div>
        <input
          type="file"
          accept={ACCEPT}
          multiple
          onChange={onPick}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>

      {files.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 font-body text-[10px] uppercase tracking-ultra text-bone/50">
            {files.length} {files.length === 1 ? 'foto lista' : 'fotos listas'} · la primera será la portada
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {files.map((f, idx) => {
              const url = URL.createObjectURL(f);
              return (
                <div
                  key={`${f.name}-${idx}`}
                  className="group relative aspect-square overflow-hidden border border-carbon-line bg-carbon-raised"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-gold px-1.5 py-0.5 font-body text-[9px] uppercase tracking-ultra text-carbon">
                      Portada
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    className="absolute right-1 top-1 rounded-full bg-carbon/80 px-2 py-0.5 font-body text-[10px] text-red-300 hover:bg-red-500/80"
                    aria-label={`Quitar ${f.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-2 font-body text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function EventosTable({ events }: { events: BarloventoEvent[] }) {
  const router = useRouter();
  const [list, setList] = useState(events);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

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
    setFiles([]);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && files.length === 0 && !draft.image) {
      setError('Subí al menos una foto para el evento.');
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
        for (const f of files) fd.append('imageFiles', f);
        const saved = await upsertEvent(fd);
        setList((prev) => {
          const idx = prev.findIndex((p) => p.id === saved.id);
          const merged: BarloventoEvent = {
            ...saved,
            images: saved.images?.length ? saved.images : [saved.image],
          };
          if (idx === -1) return [merged, ...prev];
          const copy = [...prev];
          copy[idx] = merged;
          return copy;
        });
        onCancel();
        router.refresh();
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
          {!editing && (
            <div className="sm:col-span-2">
              <p className="mb-1 font-body text-[10px] uppercase tracking-ultra text-bone/50">
                Fotos del evento
              </p>
              <MiniMultiPicker files={files} onChange={setFiles} maxSizeMB={8} />
              <p className="mt-1 font-body text-[11px] text-bone/50">
                La primera foto será la portada. Después de crearlo podés agregar más o reordenar desde la lista.
              </p>
            </div>
          )}
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
              <th className="p-3">Fotos</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => (
              <EventRow
                key={e.id}
                index={i}
                event={e}
                isEditing={editing === e.id}
                isBusy={busyId === e.id}
                listLength={list.length}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onCloseEditor={onCancel}
                onImagesChanged={() => router.refresh()}
              />
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-bone/50 font-body text-sm">
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

function EventRow({
  index,
  event,
  isEditing,
  isBusy,
  listLength,
  onEdit,
  onDelete,
  onMove,
  onCloseEditor,
  onImagesChanged,
}: {
  index: number;
  event: BarloventoEvent;
  isEditing: boolean;
  isBusy: boolean;
  listLength: number;
  onEdit: (e: BarloventoEvent) => void;
  onDelete: (id: number) => void;
  onMove: (e: BarloventoEvent, dir: -1 | 1) => void;
  onCloseEditor: () => void;
  onImagesChanged: () => void;
}) {
  return (
    <>
      <tr
        className={[
          'border-b border-carbon-line/40',
          isBusy ? 'opacity-50' : '',
        ].join(' ')}
      >
        <td className="p-3">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => onMove(event, -1)}
              disabled={index === 0}
              className="text-bone/50 hover:text-gold disabled:opacity-30"
              aria-label="Subir"
            >▲</button>
            <button
              onClick={() => onMove(event, 1)}
              disabled={index === listLength - 1}
              className="text-bone/50 hover:text-gold disabled:opacity-30"
              aria-label="Bajar"
            >▼</button>
          </div>
        </td>
        <td className="p-3 font-body text-sm text-bone/80">{event.date}</td>
        <td className="p-3 font-body text-sm text-bone">{event.title}</td>
        <td className="p-3 font-body text-sm text-bone/70">{event.location}</td>
        <td className="p-3 font-body text-xs text-bone/60">{event.images.length}</td>
        <td className="p-3">
          <span
            className={[
              'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-ultra',
              event.kind === 'upcoming'
                ? 'bg-gold/20 text-gold'
                : 'bg-carbon-line text-bone/50',
            ].join(' ')}
          >
            {event.kind}
          </span>
        </td>
        <td className="p-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => (isEditing ? onCloseEditor() : onEdit(event))}
              className={[
                'rounded-full border px-3 py-1 font-body text-[11px] uppercase tracking-ultra transition',
                isEditing
                  ? 'border-bone/40 text-bone/60 hover:bg-bone/10'
                  : 'border-gold/40 text-gold hover:bg-gold hover:text-carbon',
              ].join(' ')}
            >
              {isEditing ? 'Cerrar' : 'Editar'}
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="rounded-full border border-red-500/40 px-3 py-1 font-body text-[11px] uppercase tracking-ultra text-red-400 hover:bg-red-500/20 transition"
            >
              Borrar
            </button>
          </div>
        </td>
      </tr>
      {isEditing && (
        <tr className="bg-carbon-raised">
          <td colSpan={7} className="p-4">
            <p className="mb-2 font-body text-[10px] uppercase tracking-ultra text-gold">
              Editor de fotos
            </p>
            <EventImageEditor
              eventId={event.id}
              onChanged={onImagesChanged}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Carga las imágenes del evento vía /api/admin/event-images y las pasa
 * al editor. Si onChanged se dispara, vuelve a fetchear para mantener
 * ids en sync (caso: el server promovió una nueva portada).
 */
function EventImageEditor({
  eventId,
  onChanged,
}: {
  eventId: number;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<ImageRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/event-images?eventId=${eventId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { images: ImageRow[] };
        if (!cancelled) setRows(data.images);
      } catch (e: any) {
        if (!cancelled) setErr(e.message ?? 'No se pudieron cargar las fotos.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (err) return <p className="font-body text-sm text-red-400">{err}</p>;
  if (!rows) return <p className="font-body text-xs text-bone/50">Cargando fotos…</p>;

  return (
    <MultiImageEditor
      eventId={eventId}
      initial={rows}
      onChanged={() => {
        // Re-fetch para que la portada promovida se vea bien y el orden
        // quede en sync con el server.
        (async () => {
          const res = await fetch(`/api/admin/event-images?eventId=${eventId}`);
          if (res.ok) {
            const data = (await res.json()) as { images: ImageRow[] };
            setRows(data.images);
          }
          onChanged();
        })();
      }}
    />
  );
}
