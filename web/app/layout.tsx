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

  // El panel de admin tiene su propia navegación (AdminNav) y no debe
  // mostrar el chrome público (Navbar/Footer/Float/Cart). Mantenerlos
  // rompía los anchors del navbar (#eventos, #galeria, etc.) que
  // navegaban a /admin#eventos en vez de a la home.
  const pathname = headers().get('x-pathname') ?? '';
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

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
