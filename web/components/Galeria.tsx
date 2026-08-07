'use client';

import { useState, useMemo } from 'react';
import { Reveal } from './Reveal';
import GoldDivider from './GoldDivider';
import type { GalleryItem, GalleryCategory } from '@/lib/queries';

const ALL = 'todas';

export default function Galeria({
  items,
  categories,
}: {
  items: GalleryItem[];
  categories: GalleryCategory[];
}) {
  const [active, setActive] = useState<string>(ALL);

  const tabs = useMemo(
    () => [
      { id: ALL, label: 'Todas' },
      ...categories
        .filter((c) => c.is_active)
        .map((c) => ({ id: c.id, label: c.label })),
    ],
    [categories]
  );

  const filtered = useMemo(
    () =>
      items
        .filter((g) => active === ALL || g.category === active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items, active]
  );

  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section id="galeria" className="bg-cream text-ink py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-24 lg:px-10">
        <Reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-eyebrow text-gold-deep">Galería</p>
              <h2 className="mt-5 h-section text-ink">El oficio, en imágenes.</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={[
                    'rounded-full border px-4 py-2 font-body text-xs uppercase tracking-ultra transition',
                    active === t.id
                      ? 'border-ink bg-ink text-cream'
                      : 'border-ink/20 text-ink/70 hover:border-ink hover:text-ink',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-16 columns-1 gap-4 sm:columns-2 lg:columns-3 [column-fill:_balance]">
          {filtered.map((g, i) => (
            <Reveal key={g.id} delay={(i % 6) * 80}>
              <button
                onClick={() => setLightbox(g.image)}
                className="group mb-4 block w-full break-inside-avoid overflow-hidden bg-ink/5 hover-zoom"
                aria-label={`Ver ${g.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image}
                  alt={g.title}
                  className="block w-full h-auto"
                />
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-carbon/95 backdrop-blur-md p-6 cursor-zoom-out"
          role="dialog"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[88vh] max-w-[92vw] object-contain shadow-2xl"
          />
          <button
            className="absolute top-6 right-6 grid h-10 w-10 place-items-center rounded-full border border-gold/40 text-bone hover:border-gold"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
