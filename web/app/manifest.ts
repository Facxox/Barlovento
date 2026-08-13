import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Barlovento · Alfajores artesanales',
    short_name: 'Barlovento',
    description:
      'Alfajores artesanales elaborados en Trinidad, Flores, Uruguay. Comprá online o por WhatsApp.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0B0B',
    theme_color: '#0B0B0B',
    lang: 'es-UY',
    icons: [
      {
        src: '/icon.jpg',
        sizes: 'any',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/Logo.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  };
}