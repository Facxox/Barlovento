import { getProducts } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function ProductosHero() {
  const products = await getProducts();
  const featured = products.slice(0, 3);

  return (
    <section id="productos" className="bg-carbon py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-24 lg:px-10">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-eyebrow">La línea</p>
            <h2 className="mt-5 h-section">
              Tres formas de decir <em className="italic font-light text-gold">Barlovento</em>.
            </h2>
            <p className="mt-6 prose-editorial max-w-xl">
              Estos son los que mejor cuentan lo que hacemos: masa que se nota,
              dulce de leche que se prueba, y un terminado que se recuerda.
            </p>
          </div>
        </Reveal>

        <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-8">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 150}>
              <article className="group">
                <div className="relative aspect-[4/5] overflow-hidden bg-carbon-raised hover-zoom">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                  {p.badge && (
                    <span className="absolute left-4 top-4 inline-flex items-center rounded-full border border-gold/60 bg-carbon/70 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-gold backdrop-blur-sm">
                      {p.badge}
                    </span>
                  )}
                </div>
                <div className="mt-6">
                  <p className="font-body text-[11px] uppercase tracking-ultra text-gold/80">
                    {p.category}
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-bone leading-tight">
                    {p.name}
                  </h3>
                  <p className="mt-3 text-bone/70 font-body text-sm leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
