'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertGalleryItem,
  deleteGalleryItem,
  moveGalleryItem,
  updateGalleryItemMeta,
} from '@/lib/admin-actions';
import type { GalleryItem, GalleryCategory } from '@/lib/queries';
import { slugify } from '@/lib/slug';
import ImageDropzone from './ImageDropzone';

// ISO → valor de <input type="datetime-local"> en la hora local del
// navegador (el admin opera desde Uruguay).
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Valor del input → ISO (UTC). Vacío = publicar ya.
function fromLocalInput(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

const scheduleFmt = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'America/Montevideo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function isScheduled(g: GalleryItem): boolean {
  return !!g.publish_at && new Date(g.publish_at).getTime() > Date.now();
}

// Los QRs quedan impresos: preferimos el dominio canónico de la env
// (mismo que usa el checkout) y si no está, el dominio actual.
function photoUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, '');
  return `${base}/galeria/${slug}`;
}

// data:image/png;base64,... → Blob (sin fetch, por si hay CSP).
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Descarga un Blob con un <a download> agregado al DOM (Firefox y algunos
// navegadores móviles ignoran el click en un <a> suelto o con data: URL).
function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

type QrState = {
  slug: string;
  url: string;
  dataUrl?: string;
  blob?: Blob;
  error?: string;
};

const inputCls =
  'mt-2 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none';
const labelCls = 'font-body text-[10px] uppercase tracking-ultra text-bone/50';
const pillCls =
  'rounded-full border px-3 py-1 font-body text-[10px] uppercase tracking-ultra transition';

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
  const [slug, setSlug] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const defaultCategory = categories[0]?.id ?? 'elaboracion';
  const [category, setCategory] = useState<string>(defaultCategory);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (!qr) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setQr(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qr]);

  // Edición inline de una foto existente.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editPublishAt, setEditPublishAt] = useState('');

  // Lista de slugs activos para el <select>. Si un item existente tiene
  // una categoría que ya no está en la lista (huérfana), la mostramos
  // igual para no perder la asignación visible.
  const activeIds = new Set(categories.filter((c) => c.is_active).map((c) => c.id));

  const scheduledCount = list.filter(isScheduled).length;

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
        fd.append('slug', slug);
        fd.append('publish_at', fromLocalInput(publishAt));
        fd.append('imageFile', file);
        const next = await upsertGalleryItem(fd);
        setList((prev) => [...prev, next]);
        setFile(null);
        setTitle('');
        setSlug('');
        setPublishAt('');
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

  const startEdit = (g: GalleryItem) => {
    setEditingId(g.id);
    setEditTitle(g.title);
    setEditSlug(g.slug);
    setEditPublishAt(toLocalInput(g.publish_at));
  };

  const saveEdit = (g: GalleryItem, publishNow = false) => {
    if (editSlug !== g.slug && !confirm(
      'Cambiar el link hace que los QRs ya impresos de esta foto dejen de funcionar. ¿Continuar?'
    )) return;
    setBusyId(g.id);
    setError(null);
    startTransition(async () => {
      try {
        const next = await updateGalleryItemMeta(g.id, {
          title: editTitle,
          slug: editSlug,
          publish_at: publishNow ? null : fromLocalInput(editPublishAt) || null,
        });
        setList((prev) => prev.map((x) => (x.id === g.id ? next : x)));
        setEditingId(null);
      } catch (err: any) {
        setError(err.message ?? 'No pudimos guardar.');
      } finally {
        setBusyId(null);
      }
    });
  };

  const copyLink = async (g: GalleryItem) => {
    try {
      await navigator.clipboard.writeText(photoUrl(g.slug));
      setNotice(`Link copiado: /galeria/${g.slug}`);
    } catch {
      setNotice(photoUrl(g.slug));
    }
  };

  // Abre el modal del QR e intenta descargarlo. Safari (sobre todo iOS) y
  // los navegadores dentro de apps pueden bloquear la descarga automática
  // porque ocurre después de un await; el modal deja la imagen visible
  // (mantener apretado → Guardar) y botones que descargan/comparten en el
  // mismo click.
  const downloadQr = async (g: GalleryItem) => {
    const url = photoUrl(g.slug);
    setQr({ slug: g.slug, url });
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      const blob = dataUrlToBlob(dataUrl);
      const file = new File([blob], `qr-${g.slug}.png`, { type: 'image/png' });
      setCanShare(
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      );
      setQr({ slug: g.slug, url, dataUrl, blob });
      try {
        saveBlob(blob, `qr-${g.slug}.png`);
      } catch {
        // Bloqueada: queda el botón del modal.
      }
    } catch (err: any) {
      setQr({ slug: g.slug, url, error: err?.message ?? 'No pudimos generar el QR.' });
    }
  };

  const shareQr = async () => {
    if (!qr?.blob) return;
    const file = new File([qr.blob], `qr-${qr.slug}.png`, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: `QR · /galeria/${qr.slug}` });
    } catch {
      // El usuario canceló el menú de compartir.
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-bone">Galería</h1>
        <p className="mt-1 font-body text-sm text-bone/60">
          {list.length - scheduledCount} imágenes publicadas
          {scheduledCount > 0 &&
            ` · ${scheduledCount} programada${scheduledCount === 1 ? '' : 's'}`}.
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
        <div className="grid gap-4 sm:col-span-8 sm:grid-cols-2">
          <div>
            <p className={labelCls}>Título</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <p className={labelCls}>Link (slug)</p>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => setSlug((s) => slugify(s))}
              placeholder={slugify(title) || 'se-genera-desde-el-titulo'}
              className={inputCls}
            />
            <p className="mt-1 font-body text-[11px] text-bone/40">
              /galeria/{slugify(slug || title) || '…'}
            </p>
          </div>
          <div>
            <p className={labelCls}>Categoría</p>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full border-b border-carbon-line bg-carbon px-2 py-2 font-body text-bone focus:border-gold outline-none"
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
          <div>
            <p className={labelCls}>Publicar el (opcional)</p>
            <input
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
            <p className="mt-1 font-body text-[11px] text-bone/40">
              Vacío = se publica ahora. Si programás, el link y el QR ya
              funcionan: muestran "Muy pronto" con cuenta regresiva.
            </p>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gold px-4 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
            >
              {busy ? 'Subiendo…' : publishAt ? 'Programar' : 'Subir'}
            </button>
          </div>
        </div>
        {error && (
          <p className="font-body text-sm text-red-400 sm:col-span-12">{error}</p>
        )}
      </form>

      {notice && (
        <p className="mb-4 font-body text-sm text-gold/90">{notice}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g, i) => {
          const scheduled = isScheduled(g);
          const editing = editingId === g.id;
          return (
            <div
              key={g.id}
              className={[
                'group relative overflow-hidden border border-carbon-line bg-carbon',
                busyId === g.id ? 'opacity-50' : '',
              ].join(' ')}
            >
              {scheduled && g.publish_at && (
                <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-carbon">
                  Programada · {scheduleFmt.format(new Date(g.publish_at))}
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.image}
                alt={g.title}
                className={['block w-full h-auto', scheduled ? 'opacity-60' : ''].join(' ')}
              />
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-body text-sm text-bone">{g.title}</p>
                  <p className="font-body text-[10px] uppercase tracking-ultra text-gold/80">
                    {g.category}
                  </p>
                  <p className="truncate font-body text-[11px] text-bone/40">
                    /galeria/{g.slug}
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
                    className={`${pillCls} border-red-500/40 text-red-400 hover:bg-red-500/20`}
                  >
                    Borrar
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 px-3 pb-3">
                <button
                  onClick={() => (editing ? setEditingId(null) : startEdit(g))}
                  className={`${pillCls} border-carbon-line text-bone/70 hover:border-gold hover:text-gold`}
                >
                  {editing ? 'Cerrar' : 'Editar'}
                </button>
                <button
                  onClick={() => copyLink(g)}
                  className={`${pillCls} border-carbon-line text-bone/70 hover:border-gold hover:text-gold`}
                >
                  Copiar link
                </button>
                <button
                  onClick={() => downloadQr(g)}
                  className={`${pillCls} border-carbon-line text-bone/70 hover:border-gold hover:text-gold`}
                >
                  Descargar QR
                </button>
              </div>

              {editing && (
                <div className="grid gap-3 border-t border-carbon-line p-3">
                  <div>
                    <p className={labelCls}>Título</p>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <p className={labelCls}>Link (slug)</p>
                    <input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      onBlur={() => setEditSlug((s) => slugify(s))}
                      className={inputCls}
                    />
                    <p className="mt-1 font-body text-[11px] text-amber-400/80">
                      Si ya imprimieron el QR, no cambien el link: el QR dejaría de funcionar.
                    </p>
                  </div>
                  <div>
                    <p className={labelCls}>Publicar el</p>
                    <input
                      type="datetime-local"
                      value={editPublishAt}
                      onChange={(e) => setEditPublishAt(e.target.value)}
                      className={`${inputCls} [color-scheme:dark]`}
                    />
                    <p className="mt-1 font-body text-[11px] text-bone/40">
                      Vacío = publicada.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => saveEdit(g)}
                      disabled={busyId === g.id}
                      className="rounded-full bg-gold px-4 py-2 font-body text-[10px] uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    {scheduled && (
                      <button
                        onClick={() => saveEdit(g, true)}
                        disabled={busyId === g.id}
                        className={`${pillCls} border-gold/60 text-gold hover:bg-gold/10`}
                      >
                        Publicar ahora
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-full p-8 text-center font-body text-sm text-bone/50 border border-carbon-line">
            Sin imágenes todavía.
          </p>
        )}
      </div>

      {qr && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setQr(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Código QR"
        >
          <div
            className="w-full max-w-sm border border-carbon-line bg-carbon p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={labelCls}>Código QR</p>
                <p className="mt-1 break-all font-body text-xs text-bone/70">{qr.url}</p>
              </div>
              <button
                onClick={() => setQr(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-carbon-line text-bone/70 hover:border-gold hover:text-gold"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid aspect-square place-items-center bg-white">
              {qr.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr.dataUrl}
                  alt={`QR de /galeria/${qr.slug}`}
                  className="block h-full w-full"
                />
              ) : qr.error ? (
                <p className="p-4 text-center font-body text-sm text-red-600">{qr.error}</p>
              ) : (
                <p className="font-body text-sm text-carbon/60">Generando…</p>
              )}
            </div>

            {qr.blob && (
              <>
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={() => saveBlob(qr.blob!, `qr-${qr.slug}.png`)}
                    className="w-full rounded-full bg-gold px-4 py-2.5 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light"
                  >
                    Descargar PNG
                  </button>
                  {canShare && (
                    <button
                      onClick={shareQr}
                      className="w-full rounded-full border border-gold/60 px-4 py-2.5 font-body text-xs uppercase tracking-ultra text-gold transition hover:bg-gold/10"
                    >
                      Compartir / Guardar
                    </button>
                  )}
                </div>
                <p className="mt-3 font-body text-[11px] text-bone/50">
                  Si no se descargó solo: tocá &quot;Descargar PNG&quot;, o mantené
                  apretada la imagen (en el celu) / clic derecho (en la compu) →
                  Guardar imagen.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
