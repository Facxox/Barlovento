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
            <ul className="mt-10 space-y-16">
              {upcoming.map((e, i) => (
                <Reveal key={e.id} delay={i * 100}>
                  <li className="grid gap-10 md:grid-cols-12 md:items-start">
                    {/* Imagen a la izquierda, compacta */}
                    <div className="md:col-span-4">
                      <div className="max-w-sm">
                        {e.image ? (
                          <img
                            src={e.image}
                            alt={e.title}
                            className="block w-full h-auto"
                          />
                        ) : (
                          <div className="grid aspect-[16/10] place-items-center bg-carbon-raised text-bone/40 font-body text-xs uppercase tracking-ultra">
                            Próximamente
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Texto a la derecha, columna ancha */}
                    <div className="md:col-span-8">
                      <p className="font-body text-xs uppercase tracking-ultra text-bone/50">
                        {formatDate(e.date)}
                      </p>
                      <h3 className="mt-4 font-display text-3xl text-bone leading-tight">
                        {e.title}
                      </h3>
                      <p className="mt-3 font-body text-xs uppercase tracking-ultra text-bone/40">
                        {e.location}
                      </p>
                      <p className="mt-6 text-bone/70 font-body text-base leading-relaxed">
                        {e.description}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-28">
            <p className="font-body text-xs uppercase tracking-ultra text-bone/40">
              Archivo
            </p>
            <div className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3 [column-fill:_balance]">
              {past.map((e, i) => (
                <Reveal key={e.id} delay={i * 80}>
                  <article className="mb-6 break-inside-avoid">
                    {e.image && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={e.image}
                        alt={e.title}
                        className="block w-full h-auto"
                      />
                    )}
                    <p className="mt-4 font-body text-[11px] uppercase tracking-ultra text-bone/40">
                      {formatDate(e.date)}
                    </p>
                    <h3 className="mt-2 font-display text-xl text-bone leading-tight">
                      {e.title}
                    </h3>
                    <p className="mt-1 font-body text-[11px] uppercase tracking-ultra text-bone/40">
                      {e.location}
                    </p>
                    <p className="mt-3 text-bone/70 font-body text-sm leading-relaxed">
                      {e.description}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
