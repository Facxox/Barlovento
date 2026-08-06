import { getSiteContent } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function Valores() {
  const { valores: va } = await getSiteContent();
  return (
    <section className="bg-cream py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-24 lg:px-10">
        <Reveal>
          <p className="text-eyebrow text-gold-deep">{va.eyebrow}</p>
          <h2 className="mt-5 h-section max-w-3xl">{va.headline}</h2>
        </Reveal>

        <div className="mt-16 grid gap-px bg-ink/10 md:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {va.items.map((item, i) => (
            <Reveal key={item.title} delay={i * 120}>
              <article className="group h-full bg-cream p-10 transition hover:bg-bone/60">
                <span className="font-body text-[11px] uppercase tracking-ultra text-gold-deep">
                  0{i + 1}
                </span>
                <h3 className="mt-6 font-display text-2xl leading-tight text-ink md:text-3xl font-light">
                  {item.title}
                </h3>
                <p className="mt-5 prose-editorial max-w-md">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
