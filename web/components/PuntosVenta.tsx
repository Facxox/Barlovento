import { getSiteContent } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function PuntosVenta() {
  const { puntos_venta: pv } = await getSiteContent();
  return (
    <section id="puntos-venta" className="bg-cream text-ink py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto grid max-w-7xl gap-16 px-6 pt-24 lg:grid-cols-12 lg:gap-20 lg:px-10">
        <div className="lg:col-span-5">
          <Reveal>
            <p className="text-eyebrow text-gold-deep">{pv.eyebrow}</p>
            <h2 className="mt-5 h-section">{pv.headline}</h2>
            <p className="mt-6 prose-editorial-light max-w-md">{pv.intro}</p>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <Reveal delay={150}>
            <ul className="grid grid-cols-2 gap-px bg-ink/10 sm:grid-cols-3 lg:grid-cols-4">
              {pv.departamentos.map((d, i) => (
                <li
                  key={d}
                  className={[
                    'group relative flex items-center gap-4 bg-cream px-5 py-7 transition',
                    'hover:bg-bone/70',
                    'before:pointer-events-none before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-gold-deep/0 before:transition before:duration-500',
                    'hover:before:bg-gold-deep/70',
                  ].join(' ')}
                >
                  <span className="font-body text-[11px] uppercase tracking-ultra text-gold-deep">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-display text-lg text-ink md:text-xl font-light whitespace-nowrap">
                    {d}
                  </span>
                  <span
                    aria-hidden
                    className="ml-auto -translate-x-1 opacity-0 text-gold-deep transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  >
                    →
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
