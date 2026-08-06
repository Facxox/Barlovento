'use client';

import { useInView } from './useInView';

export default function Hero() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.1 });

  return (
    <section
      id="inicio"
      ref={ref}
      className="relative min-h-screen overflow-hidden bg-carbon"
    >
      {/* Imagen de fondo full-bleed, una sola, nítida. El "corte" del alfajor
          lo marca una línea dorada centrada, no dos mitades reescaladas. */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Assets/Foto hero editorial.png"
          alt="Detalle de alfajor Barlovento"
          className="h-full w-full object-cover"
        />

        {/* Línea dorada eliminada */}
        {/* Overlay sutil para legibilidad del texto */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-carbon/40 via-carbon/30 to-carbon/85" />
      </div>

      {/* Contenido */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-6 pb-24 pt-32 lg:px-10 lg:pb-32">
        <div className="max-w-3xl">
          <p
            className={[
              'text-eyebrow transition-opacity duration-1000 delay-700',
              inView ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            Alfajores artesanales · Trinidad, Uruguay
          </p>

          <h1
            className={[
              'mt-6 h-display text-bone transition-all duration-1000 delay-[900ms]',
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
            ].join(' ')}
          >
            Irresistibles.
            <br />
            <span className="italic text-gold font-light">Hechos a mano.</span>
          </h1>

          <p
            className={[
              'mt-6 max-w-xl prose-editorial transition-opacity duration-1000 delay-[1100ms]',
              inView ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            Cada alfajor Barlovento pasa por cuatro manos antes de llegar a la tuya.
            Reposo largo, materia prima local y un baño de chocolate que termina el trabajo.
          </p>

          <div
            className={[
              'mt-10 flex flex-col gap-3 sm:flex-row sm:items-center transition-opacity duration-1000 delay-[1300ms]',
              inView ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            <a
              href="#tienda"
              className="group inline-flex items-center gap-3 rounded-full bg-gold px-7 py-3.5 font-body text-sm font-medium text-carbon transition hover:bg-gold-light"
            >
              Ver tienda
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#historia"
              className="gold-underline inline-flex items-center gap-2 font-body text-sm uppercase tracking-ultra text-bone"
            >
              Nuestra historia
            </a>
          </div>
        </div>

        {/* Badge de medalla arriba a la derecha */}
        <div
          className={[
            'absolute right-6 top-32 hidden lg:block transition-all duration-1000 delay-[1500ms]',
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
          ].join(' ')}
        >
          <div className="flex items-center gap-3 rounded-full border border-gold/40 bg-carbon/70 px-4 py-2 animate-soft-pulse">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Assets/premio-pyme-oro-2024.png"
              alt="Medalla de Oro — Campeonato Mundial del Alfajor 2024"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              width={36}
              height={36}
            />
            <div className="font-body text-[11px] uppercase tracking-ultra text-bone">
              Medalla de Oro
              <span className="block text-gold/80 normal-case tracking-normal mt-0.5">
                Mejor Alfajor Pyme · Trinidad · 2024
              </span>
            </div>
          </div>
        </div>

        {/* Indicador de scroll */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-eyebrow">scroll</span>
          <span className="block h-8 w-px bg-gradient-to-b from-gold to-transparent" />
        </div>
      </div>
    </section>
  );
}