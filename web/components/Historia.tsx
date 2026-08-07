import { getSiteContent } from '@/lib/queries';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';

export default async function Historia() {
  const { historia: h } = await getSiteContent();

  // Renderiza la sección de imágenes: collage asimétrico cuando hay 2+,
  // figura única cuando hay 1, fallback a `image` legacy si `images` está
  // vacío. Las imágenes respetan su aspect ratio original (w-full h-auto)
  // — no se les fuerza altura ni se recortan.
  const renderImage = (
    img: { url: string; caption: string | null },
    key: string | number
  ) => (
    <figure key={key}>
      <div className="overflow-hidden bg-ink/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? ''}
          className="block w-full h-auto"
        />
      </div>
      {img.caption && (
        <figcaption className="mt-3 font-body text-xs uppercase tracking-ultra text-ink/50">
          {img.caption}
        </figcaption>
      )}
    </figure>
  );

  const renderImages = () => {
    if (h.images.length === 0) {
      // Fallback: usar la imagen legacy si existe
      if (h.image) {
        return renderImage({ url: h.image, caption: h.image_caption }, 'legacy');
      }
      return null;
    }

    if (h.images.length === 1) {
      return renderImage(h.images[0], 0);
    }

    // 2+ imágenes: collage asimétrico. Primera grande (col-span-8),
    // resto como thumbnails apilados (col-span-4). items-start deja
    // que cada columna respete su propia altura natural sin forzar
    // stretch (importante: las imágenes conservan su aspect ratio).
    const [first, ...rest] = h.images;
    return (
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 md:col-span-8">{renderImage(first, 0)}</div>
        <div className="col-span-12 md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-4">
          {rest.map((img, i) => renderImage(img, i + 1))}
        </div>
      </div>
    );
  };

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
            <div className="mt-12">{renderImages()}</div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
