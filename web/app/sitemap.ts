import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/queries';

// Site URL canónico. Coincide con `metadataBase` en app/layout.tsx.
const SITE_URL = 'https://barlovento.uy';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
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
  ];
}