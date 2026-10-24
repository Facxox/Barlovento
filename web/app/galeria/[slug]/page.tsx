import Link from 'next/link';
import { notFound } from 'next/navigation';
import GoldDivider from '@/components/GoldDivider';
import GaleriaCountdown from '@/components/GaleriaCountdown';
import { getGalleryPageBySlug, getGalleryCategories } from '@/lib/queries';

// Página propia de cada foto de la galería. Es el destino de los QRs que
// imprime Barlovento, así que el slug no debería cambiar una vez impreso.
// Las fotos programadas (publish_at futuro) ya responden en su link con un
// "Muy pronto" + cuenta regresiva, sin título ni imagen, y al llegar la
// hora la misma página muestra la foto.

const revealFmt = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'America/Montevideo',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const page = await getGalleryPageBySlug(params.slug);
  if (!page) return { title: 'Galería · Barlovento' };

  if (page.status === 'scheduled') {
    const title = 'Muy pronto · Galería Barlovento';
    const description = 'Algo especial se revela muy pronto en la galería de Barlovento.';
    return {
      title,
      description,
      robots: { index: false },
      openGraph: {
        title,
        description,
        type: 'website',
        url: `https://barloventoirresistibles.com.uy/galeria/${params.slug}`,
        images: [{ url: '/Logo.jpg', alt: 'Barlovento' }],
      },
      twitter: { card: 'summary', title, description, images: ['/Logo.jpg'] },
    };
  }

  const item = page.item;
  const title = `${item.title} · Galería Barlovento`;
  const description = 'Explorá nuestra galería y conocé la esencia de Barlovento.';
  return {
    title,
    description,
    alternates: {
      canonical: `/galeria/${item.slug}`,
      languages: { 'es-UY': `/galeria/${item.slug}` },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://barloventoirresistibles.com.uy/galeria/${item.slug}`,
      images: [{ url: item.image, alt: item.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [item.image],
    },
  };
}

export default async function GaleriaFotoPage({
  params,
}: {
  params: { slug: string };
}) {
  const [page, categories] = await Promise.all([
    getGalleryPageBySlug(params.slug),
    getGalleryCategories(),
  ]);
  if (!page) notFound();

  if (page.status === 'scheduled') {
    return (
      <section className="bg-cream text-ink py-24 lg:py-32">
        <GoldDivider />

        <div className="mx-auto max-w-3xl px-6 pt-16 text-center lg:px-10">
          <p className="text-eyebrow text-gold-deep">Galería Barlovento</p>
          <h1 className="mt-5 h-section text-ink">Muy pronto</h1>
          <p className="mx-auto mt-6 max-w-md font-body text-base text-ink/70">
            Algo especial se revela acá el{' '}
            <span className="text-ink">
              {revealFmt.format(new Date(page.publish_at))} h
            </span>
            . Guardá este link y volvé.
          </p>

          <div className="mt-12">
            <GaleriaCountdown publishAt={page.publish_at} />
          </div>

          <div className="mt-14">
            <Link
              href="/#galeria"
              className="inline-flex items-center justify-center rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon"
            >
              Ver la galería
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const item = page.item;
  const categoryLabel =
    categories.find((c) => c.id === item.category)?.label ?? item.category;

  return (
    <section className="bg-cream text-ink py-24 lg:py-32">
      <GoldDivider />

      <div className="mx-auto max-w-5xl px-6 pt-16 lg:px-10">
        <Link
          href="/#galeria"
          className="inline-block font-body text-[10px] uppercase tracking-ultra text-gold-deep hover:text-ink"
        >
          ← Volver a la galería
        </Link>

        <p className="mt-10 text-eyebrow text-gold-deep">
          Galería · {categoryLabel}
        </p>
        <h1 className="mt-5 h-section text-ink">{item.title}</h1>

        <div className="mt-10 bg-ink/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt={item.title}
            className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/#galeria"
            className="inline-flex items-center justify-center rounded-full bg-ink px-7 py-3.5 font-body text-xs uppercase tracking-ultra text-cream transition hover:bg-gold hover:text-carbon"
          >
            Ver toda la galería
          </Link>
        </div>
      </div>
    </section>
  );
}
