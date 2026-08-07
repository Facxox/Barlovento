'use client';

import { useState, useTransition } from 'react';
import { upsertSiteContent, uploadHistoryImage, uploadHeroImage } from '@/lib/admin-actions';
import type { SiteContent } from '@/lib/queries';
import ImageDropzone from './ImageDropzone';

type Key = keyof SiteContent;

export default function TextosEditor({ initial }: { initial: SiteContent }) {
  const [textos, setTextos] = useState<SiteContent>(initial);
  const [saved, setSaved] = useState<Key | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyFile, setHistoryFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const onPickHistoryImage = (f: File | null) => {
    setHistoryFile(f);
    if (f) {
      setUploadingImage(true);
      setError(null);
      startTransition(async () => {
        try {
          const fd = new FormData();
          fd.append('imageFile', f);
          const url = await uploadHistoryImage(fd);
          setTextos((prev) => ({
            ...prev,
            historia: {
              ...prev.historia,
              image: url,
              // Mantener sincronizada la primera imagen del array
              images: prev.historia.images.length > 0
                ? prev.historia.images.map((img, i) =>
                    i === 0 ? { ...img, url } : img
                  )
                : [{ url, caption: prev.historia.image_caption }],
            },
          }));
        } catch (err: any) {
          setError(err.message ?? 'Error al subir la imagen.');
        } finally {
          setUploadingImage(false);
          setHistoryFile(null);
        }
      });
    }
  };

  const onPickHeroImage = (f: File | null) => {
    setHeroFile(f);
    if (f) {
      setUploadingImage(true);
      setError(null);
      startTransition(async () => {
        try {
          const fd = new FormData();
          fd.append('imageFile', f);
          const url = await uploadHeroImage(fd);
          setTextos((prev) => ({
            ...prev,
            hero: { ...prev.hero, background_image: url },
          }));
        } catch (err: any) {
          setError(err.message ?? 'Error al subir la imagen del hero.');
        } finally {
          setUploadingImage(false);
          setHeroFile(null);
        }
      });
    }
  };

  const save = (key: Key) => {
    setBusy(key);
    setError(null);
    startTransition(async () => {
      try {
        await upsertSiteContent(key, textos[key]);
        setSaved(key);
        setBusy(null);
        setTimeout(() => setSaved((s) => (s === key ? null : s)), 2500);
      } catch (err: any) {
        setError(err.message ?? 'Error al guardar.');
        setBusy(null);
      }
    });
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-bone">Textos de marca</h1>
        <p className="mt-1 font-body text-sm text-bone/60">
          Editá las secciones que aparecen en el sitio.
        </p>
      </header>

      {error && (
        <p className="mb-6 font-body text-sm text-red-400">{error}</p>
      )}

      <div className="space-y-10">
        <Section
          title="Hero (portada del sitio)"
          k="hero"
          saved={saved === 'hero'}
          busy={busy === 'hero'}
          onSave={() => save('hero')}
        >
          <Input
            label="Eyebrow (texto chico arriba del título)"
            value={textos.hero.eyebrow}
            onChange={(v) =>
              setTextos({ ...textos, hero: { ...textos.hero, eyebrow: v } })
            }
          />
          <Input
            label="Titular grande"
            value={textos.hero.headline}
            onChange={(v) =>
              setTextos({ ...textos, hero: { ...textos.hero, headline: v } })
            }
          />
          <Textarea
            label="Introducción"
            rows={3}
            value={textos.hero.intro}
            onChange={(v) =>
              setTextos({ ...textos, hero: { ...textos.hero, intro: v } })
            }
          />
          <Input
            label="Texto del botón principal"
            value={textos.hero.cta_label}
            onChange={(v) =>
              setTextos({ ...textos, hero: { ...textos.hero, cta_label: v } })
            }
          />
          <Input
            label="Link del botón (ej: #tienda o /productos)"
            value={textos.hero.cta_href}
            onChange={(v) =>
              setTextos({ ...textos, hero: { ...textos.hero, cta_href: v } })
            }
          />
          <ImageDropzone
            file={heroFile}
            onFile={onPickHeroImage}
            previewUrl={textos.hero.background_image || undefined}
            label="Imagen de fondo del Hero"
            aspect="video"
          />
          {uploadingImage && (
            <p className="font-body text-[11px] text-bone/50">Subiendo imagen…</p>
          )}
          <p className="font-body text-[10px] text-bone/40">
            El badge "Medalla de Oro" arriba a la derecha no se edita — es identidad de marca.
          </p>
        </Section>

        <Section
          title="Historia"
          k="historia"
          saved={saved === 'historia'}
          busy={busy === 'historia'}
          onSave={() => save('historia')}
        >
          <Input
            label="Eyebrow"
            value={textos.historia.eyebrow}
            onChange={(v) =>
              setTextos({ ...textos, historia: { ...textos.historia, eyebrow: v } })
            }
          />
          <Input
            label="Titular"
            value={textos.historia.headline}
            onChange={(v) =>
              setTextos({ ...textos, historia: { ...textos.historia, headline: v } })
            }
          />
          <Textarea
            label="Cuerpo (una línea por párrafo)"
            rows={6}
            value={textos.historia.body.join('\n')}
            onChange={(v) =>
              setTextos({
                ...textos,
                historia: {
                  ...textos.historia,
                  body: v.split('\n').filter((s) => s.trim().length > 0),
                },
              })
            }
          />
          <ImageListEditor
            items={textos.historia.images}
            onChange={(images) =>
              setTextos({ ...textos, historia: { ...textos.historia, images } })
            }
            onError={setError}
            onBusyChange={setUploadingImage}
          />
          {uploadingImage && (
            <p className="font-body text-[11px] text-bone/50">Subiendo imagen…</p>
          )}
        </Section>

        <Section
          title="Misión"
          k="mision"
          saved={saved === 'mision'}
          busy={busy === 'mision'}
          onSave={() => save('mision')}
        >
          <Input
            label="Eyebrow"
            value={textos.mision.eyebrow}
            onChange={(v) =>
              setTextos({ ...textos, mision: { ...textos.mision, eyebrow: v } })
            }
          />
          <Input
            label="Titular"
            value={textos.mision.headline}
            onChange={(v) =>
              setTextos({ ...textos, mision: { ...textos.mision, headline: v } })
            }
          />
          <Textarea
            label="Cuerpo"
            rows={4}
            value={textos.mision.body}
            onChange={(v) =>
              setTextos({ ...textos, mision: { ...textos.mision, body: v } })
            }
          />
        </Section>

        <Section
          title="Visión"
          k="vision"
          saved={saved === 'vision'}
          busy={busy === 'vision'}
          onSave={() => save('vision')}
        >
          <Input
            label="Eyebrow"
            value={textos.vision.eyebrow}
            onChange={(v) =>
              setTextos({ ...textos, vision: { ...textos.vision, eyebrow: v } })
            }
          />
          <Input
            label="Titular"
            value={textos.vision.headline}
            onChange={(v) =>
              setTextos({ ...textos, vision: { ...textos.vision, headline: v } })
            }
          />
          <Textarea
            label="Cuerpo"
            rows={4}
            value={textos.vision.body}
            onChange={(v) =>
              setTextos({ ...textos, vision: { ...textos.vision, body: v } })
            }
          />
        </Section>

        <Section
          title="Valores"
          k="valores"
          saved={saved === 'valores'}
          busy={busy === 'valores'}
          onSave={() => save('valores')}
        >
          <Input
            label="Eyebrow"
            value={textos.valores.eyebrow}
            onChange={(v) =>
              setTextos({ ...textos, valores: { ...textos.valores, eyebrow: v } })
            }
          />
          <Input
            label="Titular"
            value={textos.valores.headline}
            onChange={(v) =>
              setTextos({ ...textos, valores: { ...textos.valores, headline: v } })
            }
          />
          <ListEditor
            label="Valores (Título y cuerpo por línea, separados por —)"
            items={textos.valores.items}
            onChange={(items) =>
              setTextos({ ...textos, valores: { ...textos.valores, items } })
            }
          />
        </Section>

        <Section
          title="Puntos de venta"
          k="puntos_venta"
          saved={saved === 'puntos_venta'}
          busy={busy === 'puntos_venta'}
          onSave={() => save('puntos_venta')}
        >
          <Input
            label="Eyebrow"
            value={textos.puntos_venta.eyebrow}
            onChange={(v) =>
              setTextos({ ...textos, puntos_venta: { ...textos.puntos_venta, eyebrow: v } })
            }
          />
          <Input
            label="Titular"
            value={textos.puntos_venta.headline}
            onChange={(v) =>
              setTextos({ ...textos, puntos_venta: { ...textos.puntos_venta, headline: v } })
            }
          />
          <Textarea
            label="Introducción"
            rows={3}
            value={textos.puntos_venta.intro}
            onChange={(v) =>
              setTextos({ ...textos, puntos_venta: { ...textos.puntos_venta, intro: v } })
            }
          />
          <Textarea
            label="Departamentos (uno por línea)"
            rows={6}
            value={textos.puntos_venta.departamentos.join('\n')}
            onChange={(v) =>
              setTextos({
                ...textos,
                puntos_venta: {
                  ...textos.puntos_venta,
                  departamentos: v
                    .split('\n')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                },
              })
            }
          />
        </Section>

        <Section
          title="Regalos empresariales"
          k="regalos_empresariales"
          saved={saved === 'regalos_empresariales'}
          busy={busy === 'regalos_empresariales'}
          onSave={() => save('regalos_empresariales')}
        >
          <Input
            label="Eyebrow"
            value={textos.regalos_empresariales.eyebrow}
            onChange={(v) =>
              setTextos({
                ...textos,
                regalos_empresariales: { ...textos.regalos_empresariales, eyebrow: v },
              })
            }
          />
          <Input
            label="Titular"
            value={textos.regalos_empresariales.headline}
            onChange={(v) =>
              setTextos({
                ...textos,
                regalos_empresariales: { ...textos.regalos_empresariales, headline: v },
              })
            }
          />
          <Textarea
            label="Cuerpo"
            rows={4}
            value={textos.regalos_empresariales.body}
            onChange={(v) =>
              setTextos({
                ...textos,
                regalos_empresariales: { ...textos.regalos_empresariales, body: v },
              })
            }
          />
          <ListEditor
            label="Casos de uso (Título y cuerpo por línea, separados por —)"
            items={textos.regalos_empresariales.items}
            onChange={(items) =>
              setTextos({
                ...textos,
                regalos_empresariales: { ...textos.regalos_empresariales, items },
              })
            }
          />
          <Input
            label="Texto del botón (CTA)"
            value={textos.regalos_empresariales.cta}
            onChange={(v) =>
              setTextos({
                ...textos,
                regalos_empresariales: { ...textos.regalos_empresariales, cta: v },
              })
            }
          />
        </Section>

        <Section
          title="Mayoristas"
          k="mayoristas"
          saved={saved === 'mayoristas'}
          busy={busy === 'mayoristas'}
          onSave={() => save('mayoristas')}
        >
          <Input
            label="Eyebrow"
            value={textos.mayoristas.eyebrow}
            onChange={(v) =>
              setTextos({ ...textos, mayoristas: { ...textos.mayoristas, eyebrow: v } })
            }
          />
          <Input
            label="Titular"
            value={textos.mayoristas.headline}
            onChange={(v) =>
              setTextos({ ...textos, mayoristas: { ...textos.mayoristas, headline: v } })
            }
          />
          <Textarea
            label="Introducción"
            rows={3}
            value={textos.mayoristas.intro}
            onChange={(v) =>
              setTextos({ ...textos, mayoristas: { ...textos.mayoristas, intro: v } })
            }
          />
          <Textarea
            label="Beneficios (uno por línea)"
            rows={5}
            value={textos.mayoristas.beneficios.join('\n')}
            onChange={(v) =>
              setTextos({
                ...textos,
                mayoristas: {
                  ...textos.mayoristas,
                  beneficios: v.split('\n').map((s) => s.trim()).filter((s) => s.length > 0),
                },
              })
            }
          />
          <Textarea
            label="Requisitos (uno por línea)"
            rows={4}
            value={textos.mayoristas.requisitos.join('\n')}
            onChange={(v) =>
              setTextos({
                ...textos,
                mayoristas: {
                  ...textos.mayoristas,
                  requisitos: v.split('\n').map((s) => s.trim()).filter((s) => s.length > 0),
                },
              })
            }
          />
        </Section>

        <Section
          title="Contacto"
          k="contacto"
          saved={saved === 'contacto'}
          busy={busy === 'contacto'}
          onSave={() => save('contacto')}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="WhatsApp"
              value={textos.contacto.whatsapp}
              onChange={(v) =>
                setTextos({ ...textos, contacto: { ...textos.contacto, whatsapp: v } })
              }
            />
            <Input
              label="Email"
              value={textos.contacto.email}
              onChange={(v) =>
                setTextos({ ...textos, contacto: { ...textos.contacto, email: v } })
              }
            />
            <Input
              label="Dirección"
              value={textos.contacto.direccion}
              onChange={(v) =>
                setTextos({ ...textos, contacto: { ...textos.contacto, direccion: v } })
              }
            />
            <Input
              label="Horarios"
              value={textos.contacto.horarios}
              onChange={(v) =>
                setTextos({ ...textos, contacto: { ...textos.contacto, horarios: v } })
              }
            />
            <Input
              label="Instagram URL"
              value={textos.contacto.instagram}
              onChange={(v) =>
                setTextos({ ...textos, contacto: { ...textos.contacto, instagram: v } })
              }
            />
            <Input
              label="Facebook URL"
              value={textos.contacto.facebook}
              onChange={(v) =>
                setTextos({ ...textos, contacto: { ...textos.contacto, facebook: v } })
              }
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  saved,
  busy,
  onSave,
  children,
}: {
  title: string;
  k: Key;
  saved: boolean;
  busy: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-carbon-line bg-carbon p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl text-bone">{title}</h2>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="font-body text-xs uppercase tracking-ultra text-emerald-400">
              Guardado ✓
            </span>
          )}
          <button
            onClick={onSave}
            disabled={busy}
            className="rounded-full bg-gold px-5 py-2 font-body text-xs uppercase tracking-ultra text-carbon transition hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
      />
    </label>
  );
}

function Textarea({
  label,
  rows,
  value,
  onChange,
}: {
  label: string;
  rows: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none resize-none"
      />
    </label>
  );
}

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: { title: string; body: string }[];
  onChange: (items: { title: string; body: string }[]) => void;
}) {
  return (
    <div className="block">
      <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        {label}
      </span>
      <div className="mt-2 space-y-3">
        {items.map((it, i) => {
          const line = `${it.title} — ${it.body}`;
          return (
            <div key={i} className="flex items-start gap-2">
              <input
                value={line}
                onChange={(e) => {
                  const next = [...items];
                  const [t = '', b = ''] = e.target.value.split('—').map((s) => s.trim());
                  next[i] = { title: t, body: b };
                  onChange(next);
                }}
                className="mt-1 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="mt-2 font-body text-[10px] uppercase tracking-ultra text-bone/40 hover:text-red-400"
                aria-label={`Quitar item ${i + 1}`}
              >
                Quitar
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onChange([...items, { title: '', body: '' }])}
          className="font-body text-[10px] uppercase tracking-ultra text-gold hover:text-gold-light"
        >
          + Agregar item
        </button>
      </div>
    </div>
  );
}

/**
 * Editor de lista de imágenes para la sección Historia. Cada slot tiene:
 * - ImageDropzone con preview de la imagen guardada.
 * - Input de caption individual.
 * - Botones ▲▼ para reordenar y Quitar.
 * - "+ Agregar imagen" al final (abre un slot vacío nuevo).
 *
 * El upload usa `uploadHistoryImage` server action; mientras sube
 * marca `onBusyChange(true)` para mostrar el mensaje global.
 */
function ImageListEditor({
  items,
  onChange,
  onError,
  onBusyChange,
}: {
  items: { url: string; caption: string | null }[];
  onChange: (items: { url: string; caption: string | null }[]) => void;
  onError: (msg: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [, startTransition] = useTransition();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const handleUpload = (file: File, index: number) => {
    setPendingFile(file);
    setPendingIndex(index);
    onError(null);
    onBusyChange(true);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append('imageFile', file);
        const url = await uploadHistoryImage(fd);
        onChange(
          items.map((img, i) => (i === index ? { ...img, url } : img))
        );
      } catch (err: any) {
        onError(err.message ?? 'Error al subir la imagen.');
      } finally {
        onBusyChange(false);
        setPendingFile(null);
        setPendingIndex(null);
      }
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const addEmpty = () =>
    onChange([...items, { url: '', caption: null }]);

  const updateCaption = (i: number, caption: string) =>
    onChange(items.map((img, idx) => (idx === i ? { ...img, caption: caption || null } : img)));

  return (
    <div>
      <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        Imágenes (la primera es la principal — collage asimétrico en la landing)
      </p>
      <div className="mt-3 space-y-5">
        {items.map((img, i) => (
          <div
            key={i}
            className="rounded-md border border-carbon-line bg-carbon-raised/30 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                Imagen {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Mover imagen ${i + 1} arriba`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="font-body text-xs uppercase tracking-ultra text-bone/60 hover:text-bone disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Mover imagen ${i + 1} abajo`}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="font-body text-[10px] uppercase tracking-ultra text-bone/40 hover:text-red-400"
                  aria-label={`Quitar imagen ${i + 1}`}
                >
                  Quitar
                </button>
              </div>
            </div>

            <ImageDropzone
              file={pendingIndex === i ? pendingFile : null}
              onFile={(f) => {
                if (f) handleUpload(f, i);
              }}
              previewUrl={img.url || undefined}
              label={img.url ? 'Reemplazar imagen' : 'Subir imagen'}
              aspect="video"
            />

            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
                Caption (opcional)
              </span>
              <input
                value={img.caption ?? ''}
                onChange={(e) => updateCaption(i, e.target.value)}
                className="mt-1 w-full border-b border-carbon-line bg-transparent px-2 py-2 font-body text-bone focus:border-gold outline-none"
              />
            </label>
          </div>
        ))}

        <button
          type="button"
          onClick={addEmpty}
          className="font-body text-[10px] uppercase tracking-ultra text-gold hover:text-gold-light"
        >
          + Agregar imagen
        </button>
      </div>
    </div>
  );
}