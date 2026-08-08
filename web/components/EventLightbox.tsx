'use client';

import { useEffect, useState } from 'react';
import type { BarloventoEvent } from '@/lib/queries';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Lightbox fullscreen para ver todas las fotos de un evento.
 * - Cierra con ✕, click en el fondo, o tecla Esc.
 * - Navega con flechas ← / → (también en pantalla).
 * - Click en miniatura salta a esa foto.
 * - Lock de scroll mientras está abierto.
 */
export default function EventLightbox({
  event,
  onClose,
}: {
  event: BarloventoEvent;
  onClose: () => void;
}) {
  const images = event.images.length ? event.images : [event.image];
  const [i, setI] = useState(0);

  // Reset al primer slide cuando cambia el evento.
  useEffect(() => {
    setI(0);
  }, [event.id]);

  // Lock scroll + atajos de teclado.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') {
        setI((v) => (v + 1) % images.length);
      }
      if (e.key === 'ArrowLeft') {
        setI((v) => (v - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [images.length, onClose]);

  const goPrev = () => setI((v) => (v - 1 + images.length) % images.length);
  const goNext = () => setI((v) => (v + 1) % images.length);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${event.title}`}
      className="fixed inset-0 z-50 bg-carbon/95 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Botón cerrar */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-bone/20 bg-carbon/70 font-body text-lg text-bone hover:border-gold hover:text-gold"
      >
        ✕
      </button>

      {/* Header: título + fecha */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 text-center">
        <p className="font-body text-[10px] uppercase tracking-ultra text-bone/60">
          {formatDate(event.date)} · {event.location}
        </p>
        <h3 className="mt-1 font-display text-xl text-bone">{event.title}</h3>
      </div>

      {/* Imagen principal */}
      <div
        className="relative flex h-full items-center justify-center px-4 pb-32 pt-24"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[i]}
          alt={`${event.title} — foto ${i + 1} de ${images.length}`}
          className="max-h-full max-w-full object-contain"
        />

        {/* Flechas */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full border border-bone/20 bg-carbon/70 font-body text-2xl text-bone hover:border-gold hover:text-gold sm:left-6"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full border border-bone/20 bg-carbon/70 font-body text-2xl text-bone hover:border-gold hover:text-gold sm:right-6"
            >
              ›
            </button>
          </>
        )}

        {/* Contador */}
        {images.length > 1 && (
          <p className="absolute bottom-32 left-1/2 -translate-x-1/2 font-body text-[11px] uppercase tracking-ultra text-bone/60">
            {i + 1} / {images.length}
          </p>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2 overflow-x-auto px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((src, idx) => (
            <button
              key={`${src}-${idx}`}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Ir a foto ${idx + 1}`}
              className={[
                'h-12 w-16 flex-shrink-0 overflow-hidden border transition',
                idx === i
                  ? 'border-gold opacity-100'
                  : 'border-carbon-line opacity-50 hover:opacity-90',
              ].join(' ')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
