import Link from 'next/link';
import { notFound } from 'next/navigation';
import GoldDivider from '@/components/GoldDivider';
import { getGalleryItemBySlug, getGalleryCategories } from '@/lib/queries';

// Página propia de cada foto de la galería. Es el destino de los QRs que
// imprime Barlovento, así que el slug no debería cambiar una vez impreso.
// Las fotos programadas (publish_at futuro) dan 404 hasta su fecha.

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const item = await getGalleryItemBySlug(params.slug);
  if (!item) return { title: 'Galería · Barlovento' };
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
  const [item, categories] = await Promise.all([
    getGalleryItemBySlug(params.slug),
    getGalleryCategories(),
  ]);
  if (!item) notFound();
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
