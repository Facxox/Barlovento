import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import CartDrawer from '@/components/CartDrawer';
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
  openGraph: {
    title: 'Barlovento · Irresistibles',
    description: 'Alfajores artesanales de Trinidad. Medalla de Oro Pyme.',
    images: ['/Assets/og-image.png'],
    type: 'website',
  },
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
      </head>
      <body>
        <CartProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <WhatsAppFloat whatsapp={contacto.whatsapp} />
          <CartDrawer whatsapp={contacto.whatsapp} />
        </CartProvider>
      </body>
    </html>
  );
}
