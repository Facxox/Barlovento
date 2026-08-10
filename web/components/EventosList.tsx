'use client';

import { useEffect, useState } from 'react';
import type { BarloventoEvent } from '@/lib/queries';
import { Reveal } from './Reveal';
import EventLightbox from './EventLightbox';
import { formatLongDateEs } from './formatDate';

export default function EventosList({
  upcoming,
  past,
}: {
  upcoming: BarloventoEvent[];
  past: BarloventoEvent[];
}) {
  const [lightboxEvent, setLightboxEvent] = useState<BarloventoEvent | null>(null);

  return (
    <>
      {upcoming.length > 0 && (
        <div className="mt-20">
          <p className="font-body text-xs uppercase tracking-ultra text-gold">
            Próximos
          </p>
          <ul className="mt-6 space-y-8">
            {upcoming.map((e, i) => (
              <Reveal key={e.id} delay={i * 100}>
                <li>
                  <button
                    type="button"
                    onClick={() => setLightboxEvent(e)}
                    className="grid w-full gap-6 border-t border-carbon-line pt-8 text-left md:grid-cols-12 md:items-center"
                    aria-label={`Ver fotos de ${e.title}`}
                  >
                    <div className="md:col-span-3">
                      {e.image && (
                        <div className="relative aspect-[16/10] overflow-hidden bg-carbon-raised hover-zoom cursor-pointer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={e.image}
                            alt={e.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <p className="mt-4 font-display text-3xl text-bone leading-tight">
                        {formatLongDateEs(e.date)}
                      </p>
                    </div>
                    <div className="md:col-span-5">
                      <h3 className="font-display text-2xl text-bone">
                        {e.title}
                      </h3>
                      <p className="mt-1 text-bone/60 font-body text-sm">{e.location}</p>
                    </div>
                    <div className="md:col-span-4">
                      <p className="text-bone/70 font-body text-sm leading-relaxed">
                        {e.description}
                      </p>
                      <p className="mt-2 font-body text-[10px] uppercase tracking-ultra text-gold/80">
                        Ver fotos →
                      </p>
                    </div>
                  </button>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-24">
          <p className="font-body text-xs uppercase tracking-ultra text-bone/40">
            Archivo
          </p>
          <ul className="mt-6 grid gap-8 md:grid-cols-2">
            {past.map((e, i) => (
              <Reveal key={e.id} delay={i * 100}>
                <li>
                  <button
                    type="button"
                    onClick={() => setLightboxEvent(e)}
                    className="group block w-full overflow-hidden bg-carbon-raised text-left cursor-pointer"
                    aria-label={`Ver fotos de ${e.title}`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden hover-zoom">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.image} alt={e.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-carbon/30" />
                      <p className="absolute bottom-3 left-4 font-body text-xs uppercase tracking-ultra text-bone/90">
                        {formatLongDateEs(e.date)}
                      </p>
                    </div>
                    <div className="p-6">
                      <h3 className="font-display text-xl text-bone">{e.title}</h3>
                      <p className="mt-1 text-bone/50 font-body text-xs uppercase tracking-ultra">
                        {e.location}
                      </p>
                      <p className="mt-3 text-bone/70 font-body text-sm leading-relaxed">
                        {e.description}
                      </p>
                      <p className="mt-3 font-body text-[10px] uppercase tracking-ultra text-gold/80">
                        Ver fotos ({e.images.length}) →
                      </p>
                    </div>
                  </button>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      )}

      {lightboxEvent && (
        <EventLightbox
          event={lightboxEvent}
          onClose={() => setLightboxEvent(null)}
        />
      )}
    </>
  );
}
