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
            <ul className="grid grid-cols-2 gap-x-8 gap-y-px bg-ink/10 sm:grid-cols-3">
              {pv.departamentos.map((d, i) => (
                <li
                  key={d}
                  className="flex items-center gap-4 bg-cream px-5 py-7"
                >
                  <span className="font-body text-[11px] uppercase tracking-ultra text-gold-deep">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-display text-xl text-ink md:text-2xl font-light">
                    {d}
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
