'use client';

import { useState, useTransition } from 'react';
import { upsertSiteContent, uploadHistoryImage } from '@/lib/admin-actions';
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
            historia: { ...prev.historia, image: url },
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
          Editá las cuatro secciones que aparecen en el sitio.
        </p>
      </header>

      {error && (
        <p className="mb-6 font-body text-sm text-red-400">{error}</p>
      )}

      <div className="space-y-10">
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
          <ImageDropzone
            file={historyFile}
            onFile={onPickHistoryImage}
            previewUrl={textos.historia.image || undefined}
            label="Imagen"
            aspect="video"
          />
          {uploadingImage && (
            <p className="font-body text-[11px] text-bone/50">Subiendo imagen…</p>
          )}
          <Input
            label="Caption de la imagen"
            value={textos.historia.image_caption ?? ''}
            onChange={(v) =>
              setTextos({
                ...textos,
                historia: { ...textos.historia, image_caption: v || null },
              })
            }
          />
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