import { getSiteContent } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function RegalosEmpresariales() {
  const { regalos_empresariales: re } = await getSiteContent();
  return (
    <section id="regalos" className="bg-carbon py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-24 lg:px-10">
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <p className="text-eyebrow">{re.eyebrow}</p>
              <h2 className="mt-5 h-section">{re.headline}</h2>
            </div>
            <div className="lg:col-span-7">
              <p className="prose-editorial max-w-editorial text-lg leading-[1.85]">
                {re.body}
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-20 grid gap-px bg-bone/10 md:grid-cols-3">
          {re.items.map((item, i) => (
            <Reveal key={item.title} delay={i * 120}>
              <article className="h-full bg-carbon p-10 transition hover:bg-carbon-raised">
                <span className="font-body text-[11px] uppercase tracking-ultra text-gold">
                  0{i + 1}
                </span>
                <h3 className="mt-6 font-display text-2xl leading-tight text-bone font-light">
                  {item.title}
                </h3>
                <p className="mt-5 prose-editorial max-w-md">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={400}>
          <div className="mt-16 flex justify-center">
            <a
              href="#contacto"
              className="group inline-flex items-center gap-3 rounded-full bg-gold px-8 py-4 font-body text-sm font-medium text-carbon transition hover:bg-gold-light"
            >
              {re.cta}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
