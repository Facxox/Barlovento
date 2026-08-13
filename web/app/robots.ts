import type { MetadataRoute } from 'next';

const SITE_URL = 'https://barlovento.uy';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Bloqueamos zonas privadas / internas / checkout-success para
        // que no aparezcan en Google y no malgasten crawl budget.
        disallow: [
          '/admin/',
          '/admin',
          '/api/',
          '/api',
          '/mi-cuenta',
          '/mi-cuenta/',
          '/checkout/success',
          '/checkout/failure',
          '/checkout/pending',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}