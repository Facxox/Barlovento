import { getSiteContent } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function MisionVision() {
  const { mision: m, vision: v } = await getSiteContent();
  return (
    <section className="bg-carbon py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-24 md:grid-cols-2 lg:px-10 lg:gap-20">
        <Reveal>
          <article className="border-l border-gold/30 pl-8">
            <p className="text-eyebrow">{m.eyebrow}</p>
            <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight text-bone font-light">
              {m.headline}
            </h3>
            <p className="mt-6 prose-editorial max-w-editorial">{m.body}</p>
          </article>
        </Reveal>

        <Reveal delay={180}>
          <article className="border-l border-gold/30 pl-8">
            <p className="text-eyebrow">{v.eyebrow}</p>
            <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight text-bone font-light">
              {v.headline}
            </h3>
            <p className="mt-6 prose-editorial max-w-editorial">{v.body}</p>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
