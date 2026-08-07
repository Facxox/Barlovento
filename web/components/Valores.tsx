import { getSiteContent } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function Valores() {
  const { valores: va } = await getSiteContent();
  return (
    <section className="bg-cream text-ink py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto max-w-7xl px-6 pt-24 lg:px-10">
        <Reveal>
          <p className="text-eyebrow text-gold-deep">{va.eyebrow}</p>
          <h2 className="mt-5 h-section max-w-3xl">{va.headline}</h2>
        </Reveal>

        {/*
          Grilla con flexbox wrap en lugar de CSS Grid. Esto evita el
          "cuadrado vacío" que aparece en grillas de 3 columnas cuando
          hay 5 items (la grilla reserva el espacio de la 6ta card).
          En flex, las cards se acomodan en filas según el ancho
          disponible sin dejar huecos. El border-bottom + border-right
          reproduce el hairline de la grilla de columnas sin usar
          gap-px sobre un fondo.

          Breakpoints:
          - mobile: 1 columna, bordes solo abajo
          - md: 2 columnas, border-right interno entre cards
          - lg: 3 columnas (5 cards → 3 + 2, sin hueco)
        */}
        <div className="mt-16 flex flex-wrap border-t border-ink/10 lg:mt-20">
          {va.items.map((item, i) => (
            <Reveal key={item.title} delay={i * 120} className="w-full md:w-1/2 lg:w-1/3">
              <article
                className={[
                  'group relative flex h-full flex-col bg-cream p-10 transition',
                  // Hairlines: bottom siempre, left solo cuando no es la primera columna de su fila
                  'border-b border-ink/10',
                  'md:even:border-l md:even:border-ink/10 md:[&:nth-child(2n)]:border-l md:[&:nth-child(2n)]:border-ink/10',
                  'lg:border-b-0 lg:[&:not(:nth-child(3n+1))]:border-l lg:[&:not(:nth-child(3n+1))]:border-ink/10',
                  // Hover state
                  'hover:bg-bone/70',
                  // Borde dorado lateral en hover
                  'before:pointer-events-none before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-gold-deep/0 before:transition before:duration-500',
                  'hover:before:bg-gold-deep/70',
                ].join(' ')}
              >
                <span className="font-body text-[11px] uppercase tracking-ultra text-gold-deep">
                  0{i + 1}
                </span>
                <h3 className="mt-6 font-display text-2xl leading-tight text-ink md:text-3xl font-light">
                  {item.title}
                </h3>
                <span
                  aria-hidden
                  className="mt-5 mb-6 block h-px w-12 bg-gold-deep/60 transition-all duration-500 group-hover:w-20 group-hover:bg-gold"
                />
                <p className="prose-editorial-light max-w-md">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
