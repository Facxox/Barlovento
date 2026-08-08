import { getEvents } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';
import EventosList from './EventosList';

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

        <EventosList upcoming={upcoming} past={past} />
      </div>
    </section>
  );
}
