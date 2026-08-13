import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import CartDrawer from '@/components/CartDrawer';
import CartToast from '@/components/CartToast';
import { CartProvider } from '@/components/CartContext';
import { getSiteContent } from '@/lib/queries';

export const metadata: Metadata = {
  metadataBase: new URL('https://barlovento.uy'),
  title: 'Barlovento · Alfajores artesanales de Trinidad, Uruguay',
  description:
    'Alfajores artesanales hechos a mano en Trinidad, Uruguay. Medalla de Oro — Mejor Alfajor Pyme. Comprá online o por WhatsApp.',
  keywords: [
    'alfajores Uruguay',
    'alfajores Trinidad',
    'alfajores artesanales',
    'Barlovento',
    'dulce de leche',
    'premio pyme',
  ],
  alternates: {
    canonical: '/',
    languages: {
      'es-UY': '/',
    },
  },
  openGraph: {
    title: 'Barlovento · Irresistibles',
    description: 'Alfajores artesanales de Trinidad. Medalla de Oro Pyme.',
    type: 'website',
    url: 'https://barlovento.uy',
    siteName: 'Barlovento',
    locale: 'es_UY',
    images: [
      {
        // Imagen por defecto al compartir la home en WhatsApp / IG / FB.
        // Reusamos el logo hasta que tengamos una pieza 1200x630 hecha.
        url: '/Logo.jpg',
        width: 1200,
        height: 630,
        alt: 'Barlovento · Alfajores artesanales de Trinidad, Uruguay',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Barlovento · Irresistibles',
    description: 'Alfajores artesanales de Trinidad. Medalla de Oro Pyme.',
    images: ['/Logo.jpg'],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0B0B0B',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { contacto } = await getSiteContent();

  // El panel de admin tiene su propia navegación (AdminNav) y no debe
  // mostrar el chrome público (Navbar/Footer/Float/Cart). Mantenerlos
  // rompía los anchors del navbar (#eventos, #galeria, etc.) que
  // navegaban a /admin#eventos en vez de a la home.
  const pathname = headers().get('x-pathname') ?? '';
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  // JSON-LD: Organization + LocalBusiness. Datos reales de
  // site-content.json (no inventamos dirección ni teléfono). El schema
  // ayuda a Google a entender la marca y mostrar rich results.
  const sameAs = [contacto.instagram, contacto.facebook].filter(Boolean);
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Barlovento',
    url: 'https://barlovento.uy',
    logo: 'https://barlovento.uy/Logo.jpg',
    description:
      'Alfajores artesanales elaborados en Trinidad, Flores, Uruguay.',
    email: contacto.email,
    telephone: contacto.whatsapp,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Trinidad',
      addressRegion: 'Flores',
      addressCountry: 'UY',
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://barlovento.uy/#business',
    name: 'Barlovento',
    url: 'https://barlovento.uy',
    image: 'https://barlovento.uy/Logo.jpg',
    email: contacto.email,
    telephone: contacto.whatsapp,
    priceRange: 'UYU',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Trinidad',
      addressRegion: 'Flores',
      addressCountry: 'UY',
    },
    openingHours: 'Mo-Fr 09:00-18:00',
    ...(sameAs.length ? { sameAs } : {}),
  };

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          // JSON.stringify seguro: contenido estático del schema.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessJsonLd),
          }}
        />
      </head>
      <body>
        {!isAdmin && (
          <CartProvider>
            <Navbar />
            <main>{children}</main>
            <Footer />
            <WhatsAppFloat whatsapp={contacto.whatsapp} />
            <CartDrawer whatsapp={contacto.whatsapp} />
            <CartToast />
          </CartProvider>
        )}
        {isAdmin && <main>{children}</main>}
      </body>
    </html>
  );
}
