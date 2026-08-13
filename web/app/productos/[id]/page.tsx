import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import ProductoDetalle from '@/components/ProductoDetalle';
import { getCategories } from '@/lib/queries';
import productsJson from '@/data/products.json';
import type { Product } from '@/lib/queries';

type ProductLookup = { product: Product; variant: 'retail' | 'wholesale' };

async function getProductById(id: string): Promise<ProductLookup | null> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    const fromJson = ((productsJson as unknown) as Product[]).find(
      (p) => p.id === id
    );
    if (!fromJson) return null;
    return { product: fromJson, variant: 'retail' };
  }

  // Buscamos primero en el catálogo retail. Si no está, probamos en
  // mayorista. Así un cliente mayorista puede abrir el detalle del
  // producto clonado (id terminado en `-ws`) sin 404.
  const { data: retail, error: retailError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (retailError) return null;
  if (retail) {
    const row = retail as Record<string, unknown> & {
      units_per_pack?: number | null;
    };
    return {
      product: {
        ...(row as unknown as Product),
        units_per_pack:
          typeof row.units_per_pack === 'number' && row.units_per_pack > 0
            ? row.units_per_pack
            : 1,
      },
      variant: 'retail',
    };
  }

  const { data: wholesale, error: wholesaleError } = await supabase
    .from('wholesale_products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (wholesaleError || !wholesale) return null;
  const wRow = wholesale as Record<string, unknown> & {
    units_per_pack?: number | null;
  };
  return {
    product: {
      ...(wRow as unknown as Product),
      units_per_pack:
        typeof wRow.units_per_pack === 'number' && wRow.units_per_pack > 0
          ? wRow.units_per_pack
          : 1,
    },
    variant: 'wholesale',
  };
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const lookup = await getProductById(params.id);
  if (!lookup) return { title: 'Producto · Barlovento' };
  const p = lookup.product;
  return {
    title: `${p.name} · Barlovento`,
    description: p.description,
    alternates: {
      canonical: `/productos/${params.id}`,
      languages: { 'es-UY': `/productos/${params.id}` },
    },
    openGraph: {
      title: `${p.name} · Barlovento`,
      description: p.description,
      type: 'website',
      url: `https://barlovento.uy/productos/${params.id}`,
      images: p.image
        ? [
            {
              url: p.image,
              alt: p.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${p.name} · Barlovento`,
      description: p.description,
      images: p.image ? [p.image] : ['/Logo.jpg'],
    },
  };
}

export default async function ProductoPage({
  params,
}: {
  params: { id: string };
}) {
  const lookup = await getProductById(params.id);
  if (!lookup) notFound();
  const categories = await getCategories();
  const p = lookup.product;

  // JSON-LD Product. Precio y currency salen de la DB (no inventamos).
  // availability=InStock es razonable para productos activos. seller
  // apunta al Organization vía @id.
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: p.image || 'https://barlovento.uy/Logo.jpg',
    sku: p.id,
    category: p.category,
    offers: {
      '@type': 'Offer',
      price: Number(p.price).toFixed(2),
      priceCurrency: p.currency,
      availability: 'https://schema.org/InStock',
      url: `https://barlovento.uy/productos/${params.id}`,
      seller: { '@id': 'https://barlovento.uy/#business' },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <ProductoDetalle
        product={p}
        categories={categories}
        isWholesale={lookup.variant === 'wholesale'}
      />
    </>
  );
}
