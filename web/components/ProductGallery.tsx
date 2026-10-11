'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Reveal } from './Reveal';
import type { ProductImage } from '@/lib/gallery';

/**
 * Galería de imágenes para la ficha de producto.
 *
 * Funciona con el shape devuelto por `resolveGallery()` (lib/gallery.ts):
 *   - `ordered` es la lista final (primary primero, resto asc por sort_order)
 *   - `primary` es la imagen destacada
 *   - `fallbackUrl` es el legacy `products.image` si no hay galería propia
 *
 * Comportamiento:
 *   - Mobile (>= sm): galería vertical con main + thumbs debajo
 *   - Desktop (lg): main grande a la izquierda, columna de thumbs a la derecha
 *   - Teclado: flechas ←/→ cambian la imagen principal
 *   - Lightbox fullscreen al hacer click en la imagen principal
 *   - Lazy loading de las imágenes no activas (native `loading="lazy"`)
 */
export default function ProductGallery({
  images,
  fallbackUrl,
  productName,
}: {
  images: ProductImage[];
  fallbackUrl: string | null;
  productName: string;
}) {
  // Si llega vacío, fabricamos una sola imagen desde el fallback.
  const list: ProductImage[] =
    images.length > 0
      ? images
      : fallbackUrl
      ? [
          {
            id: -1,
            url: fallbackUrl,
            alt: null,
            sort_order: 0,
            is_primary: true,
          },
        ]
      : [];

  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Si cambia la lista (ej: navegación SPA entre productos), reseteamos.
  useEffect(() => {
    setActiveIdx(0);
    setLightboxOpen(false);
  }, [list.length > 0 ? (list[0] ? list[0].id : 0) : 0]);

  const goPrev = useCallback(() => {
    setActiveIdx((i) => (i - 1 + list.length) % list.length);
  }, [list.length]);
  const goNext = useCallback(() => {
    setActiveIdx((i) => (i + 1) % list.length);
  }, [list.length]);

  // Keyboard nav
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, goPrev, goNext]);

  if (list.length === 0) {
    return (
      <Reveal>
        <div className="relative aspect-[4/5] overflow-hidden bg-ink/5 grid place-items-center">
          <span className="font-body text-xs text-ink/50">
            Sin imagen
          </span>
        </div>
      </Reveal>
    );
  }

  const active = list[activeIdx] ?? list[0];

  return (
    <Reveal>
      <div className="space-y-3">
        {/* Imagen principal */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={`Ampliar imagen de ${productName}`}
            className="group block w-full overflow-hidden bg-ink/5 aspect-[4/5] relative"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.alt ?? productName}
              // La primera se carga eager para no demorar LCP
              loading={activeIdx === 0 ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={activeIdx === 0 ? 'high' : 'auto'}
              className="block h-full w-full object-cover transition-opacity duration-300"
            />
            {/* Overlay hover (solo desktop) */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-ink/0 transition group-hover:bg-ink/15 lg:flex"
            >
              <span className="rounded-full bg-bone/90 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-ink opacity-0 transition group-hover:opacity-100">
                Ampliar
              </span>
            </span>
          </button>

          {/* Controles prev/next — sólo si hay más de una foto */}
          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Imagen anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-cream/90 text-ink shadow-sm transition hover:bg-cream"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Siguiente imagen"
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-cream/90 text-ink shadow-sm transition hover:bg-cream"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              {/* Contador */}
              <span className="absolute right-3 top-3 rounded-full bg-ink/60 px-2.5 py-1 font-body text-[10px] text-cream">
                {activeIdx + 1} / {list.length}
              </span>
            </>
          )}
        </div>

        {/* Miniaturas — visibles sólo si hay 2+ */}
        {list.length > 1 && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-2 lg:overflow-visible"
            role="tablist"
            aria-label="Miniaturas de la galería"
          >
            {list.map((img, i) => (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={i === activeIdx}
                onClick={() => setActiveIdx(i)}
                className={[
                  'relative aspect-square shrink-0 overflow-hidden border-2 transition lg:shrink',
                  i === activeIdx
                    ? 'border-gold'
                    : 'border-transparent hover:border-ink/30',
                ].join(' ')}
                style={{ minWidth: '64px' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="block h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <Lightbox
          list={list}
          activeIdx={activeIdx}
          setActiveIdx={setActiveIdx}
          productName={productName}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </Reveal>
  );
}

function Lightbox({
  list,
  activeIdx,
  setActiveIdx,
  productName,
  onClose,
}: {
  list: ProductImage[];
  activeIdx: number;
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>;
  productName: string;
  onClose: () => void;
}) {
  const active = list[activeIdx] ?? list[0];
  const prev = () => {
    setActiveIdx((i) => (i - 1 + list.length) % list.length);
  };
  const next = () => {
    setActiveIdx((i) => (i + 1) % list.length);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galería ampliada de ${productName}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar"
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Siguiente"
            className="absolute right-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </>
      )}
      <figure
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.url}
          alt={active.alt ?? productName}
          className="max-h-[90vh] max-w-[90vw] object-contain"
        />
        {list.length > 1 && (
          <figcaption className="absolute -bottom-8 left-1/2 -translate-x-1/2 font-body text-xs text-bone/80">
            {activeIdx + 1} / {list.length}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
