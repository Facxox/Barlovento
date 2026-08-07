import { getEvents } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('es-UY', { day: '2-digit' }),
    month: d.toLocaleDateString('es-UY', { month: 'short' }).replace('.', ''),
  };
}

export default async function Eventos() {
  const events = await getEvents();
  const upcoming = events.filter((e) => e.kind === 'upcoming');
  const past = events.filter((e) => e.kind === 'past');
  if (upcoming.length === 0 && past.length === 0) return null;

  return (
    <section id="eventos" className="bg-carbon py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-24 lg:px-10">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-eyebrow">Eventos y ferias</p>
            <h2 className="mt-5 h-section">
              Donde nos encontramos.
            </h2>
            <p className="mt-5 prose-editorial max-w-xl">
              Proba nuestra línea en persona. Estos son los próximos encuentros
              y los que ya quedaron en la memoria.
            </p>
          </div>
        </Reveal>

        {upcoming.length > 0 && (
          <div className="mt-20">
            <p className="font-body text-xs uppercase tracking-ultra text-gold">
              Próximos
            </p>
            <ul className="mt-8 space-y-10">
              {upcoming.map((e, i) => {
                const short = formatShortDate(e.date);
                return (
                  <Reveal key={e.id} delay={i * 100}>
                    <li className="group grid gap-8 border-t border-carbon-line pt-8 md:grid-cols-12 md:gap-10 md:items-stretch">
                      {/* Imagen a la izquierda, protagonista */}
                      <div className="md:col-span-7">
                        {e.image ? (
                          <div className="relative aspect-[16/10] overflow-hidden bg-carbon-raised hover-zoom">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={e.image}
                              alt={e.title}
                              className="h-full w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-carbon/40 via-transparent to-transparent" />
                          </div>
                        ) : (
                          <div className="grid aspect-[16/10] place-items-center bg-carbon-raised text-bone/40 font-body text-xs uppercase tracking-ultra">
                            Próximamente
                          </div>
                        )}
                      </div>

                      {/* Texto a la derecha, columna estrecha y editorial */}
                      <div className="flex flex-col justify-center md:col-span-5">
                        <div className="flex items-baseline gap-4">
                          <span className="font-display text-5xl text-bone leading-none">
                            {short.day}
                          </span>
                          <span className="font-body text-xs uppercase tracking-ultra text-gold">
                            {short.month}
                          </span>
                        </div>
                        <h3 className="mt-5 font-display text-3xl text-bone leading-tight">
                          {e.title}
                        </h3>
                        <p className="mt-3 font-body text-xs uppercase tracking-ultra text-bone/50">
                          {e.location}
                        </p>
                        <p className="mt-5 text-bone/70 font-body text-base leading-relaxed">
                          {e.description}
                        </p>
                        <p className="mt-5 font-body text-[11px] uppercase tracking-ultra text-bone/40">
                          {formatDate(e.date)}
                        </p>
                      </div>
                    </li>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-28">
            <p className="font-body text-xs uppercase tracking-ultra text-bone/40">
              Archivo
            </p>
            <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((e, i) => (
                <Reveal key={e.id} delay={i * 100}>
                  <li className="group flex h-full flex-col overflow-hidden border border-carbon-line bg-carbon-raised transition hover:border-gold/40">
                    <div className="relative aspect-[4/3] overflow-hidden bg-carbon hover-zoom">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.image}
                        alt={e.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-carbon/60 via-carbon/10 to-transparent" />
                      <span className="absolute bottom-4 left-4 inline-flex items-center rounded-full border border-gold/40 bg-carbon/70 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-gold backdrop-blur-sm">
                        {formatDate(e.date)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-2xl text-bone leading-tight">
                        {e.title}
                      </h3>
                      <p className="mt-2 font-body text-[11px] uppercase tracking-ultra text-bone/50">
                        {e.location}
                      </p>
                      <p className="mt-4 text-bone/70 font-body text-sm leading-relaxed">
                        {e.description}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
