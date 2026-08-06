import { getSiteContent } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function Historia() {
  const { historia: h } = await getSiteContent();
  return (
    <section id="historia" className="bg-cream text-ink py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto grid max-w-7xl gap-16 px-6 pt-24 lg:grid-cols-12 lg:gap-20 lg:px-10">
        <div className="lg:col-span-5">
          <Reveal>
            <p className="text-eyebrow text-gold-deep">{h.eyebrow}</p>
            <h2 className="mt-5 h-section">{h.headline}</h2>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <Reveal delay={150}>
            <div className="space-y-6 font-body text-lg leading-[1.85] text-ink/80 max-w-editorial">
              {h.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <figure className="mt-12">
              <div className="overflow-hidden bg-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.image}
                  alt={h.image_caption ?? ''}
                  className="h-[460px] w-full object-cover"
                />
              </div>
              <figcaption className="mt-3 font-body text-xs uppercase tracking-ultra text-ink/50">
                {h.image_caption}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
