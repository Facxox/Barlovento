import type { MetadataRoute } from 'next';
import { getProducts, getGallery } from '@/lib/queries';

// Site URL canónico. Coincide con `metadataBase` en app/layout.tsx.
const SITE_URL = 'https://barloventoirresistibles.com.uy';

// Se regenera cada hora para que las fotos programadas de la galería
// entren al sitemap sin esperar a un redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, gallery] = await Promise.all([getProducts(), getGallery()]);
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    ...products.map((p) => ({
      url: `${SITE_URL}/productos/${p.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...gallery.map((g) => ({
      url: `${SITE_URL}/galeria/${g.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}