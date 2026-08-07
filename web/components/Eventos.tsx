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
            <ul className="mt-6 space-y-8">
              {upcoming.map((e, i) => (
                <Reveal key={e.id} delay={i * 100}>
                  <li className="grid gap-6 border-t border-carbon-line pt-8 md:grid-cols-12 md:items-center">
                    <div className="md:col-span-3">
                      {e.image && (
                        <div className="relative aspect-[16/10] overflow-hidden bg-carbon-raised hover-zoom">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={e.image}
                            alt={e.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <p className="mt-4 font-display text-3xl text-bone leading-tight">
                        {formatDate(e.date)}
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
                    </div>
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
                  <li className="group overflow-hidden bg-carbon-raised">
                    <div className="relative aspect-[16/10] overflow-hidden hover-zoom">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.image} alt={e.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-carbon/30" />
                      <p className="absolute bottom-3 left-4 font-body text-xs uppercase tracking-ultra text-bone/90">
                        {formatDate(e.date)}
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
