import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteContent } from '@/lib/queries';
import LegalPage, { LegalSection } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Cookies y almacenamiento · Barlovento',
  description:
    'Qué guarda el sitio de Barlovento en tu navegador: solo la sesión de tu cuenta y el carrito. Sin cookies de publicidad ni de seguimiento de terceros.',
  alternates: { canonical: '/cookies' },
};

const rows = [
  {
    name: 'sb-…-auth-token',
    type: 'Cookie (puede dividirse en partes .0, .1)',
    purpose:
      'Mantiene iniciada la sesión de tu cuenta (Supabase) para que puedas ver Mi cuenta y tus pedidos sin volver a ingresar.',
    duration: 'Hasta que cerrás sesión o vence la sesión.',
  },
  {
    name: 'barlovento.cart',
    type: 'Almacenamiento local (localStorage)',
    purpose:
      'Guarda los productos de tu carrito para que no se pierdan si recargás la página o volvés más tarde.',
    duration: 'Hasta que finalizás la compra, vaciás el carrito o borrás los datos del navegador.',
  },
];

export default async function CookiesPage() {
  const { contacto } = await getSiteContent();

  return (
    <LegalPage
      title="Cookies y almacenamiento"
      current="/cookies"
      intro={
        <p>
          Las cookies y el almacenamiento local son pequeños datos que un sitio
          guarda en tu navegador. En Barlovento usamos lo mínimo: solo lo
          técnicamente necesario para que funcionen tu cuenta y el carrito.{' '}
          <strong className="font-medium text-bone">
            No usamos cookies de publicidad, de redes sociales ni de medición de
            terceros
          </strong>
          , por eso no te mostramos un cartel pidiendo que las aceptes.
        </p>
      }
    >
      <LegalSection title="1. Qué guardamos en tu navegador">
        <div className="overflow-x-auto rounded-md border border-carbon-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-carbon-raised">
              <tr>
                <th className="px-4 py-3 font-medium text-bone">Nombre</th>
                <th className="px-4 py-3 font-medium text-bone">Tipo</th>
                <th className="px-4 py-3 font-medium text-bone">Para qué</th>
                <th className="px-4 py-3 font-medium text-bone">Duración</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-carbon-line align-top">
                  <td className="px-4 py-3 font-mono text-xs text-gold">{r.name}</td>
                  <td className="px-4 py-3 text-bone/70">{r.type}</td>
                  <td className="px-4 py-3 text-bone/80">{r.purpose}</td>
                  <td className="px-4 py-3 text-bone/70">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          La cookie de sesión solo aparece si iniciás sesión. Si comprás sin
          cuenta, lo único que se guarda es el carrito.
        </p>
      </LegalSection>

      <LegalSection title="2. Por qué no hay cartel de cookies">
        <p>
          Todo lo que guardamos es estrictamente necesario para darte el
          servicio que pedís (comprar y usar tu cuenta). No lo usamos para
          seguirte por otros sitios ni para mostrarte publicidad. Si en el
          futuro sumamos herramientas de medición o publicidad de terceros (por
          ejemplo, Google Analytics o el píxel de Meta), vamos a actualizar esta
          página y pedirte tu consentimiento antes de activarlas.
        </p>
      </LegalSection>

      <LegalSection title="3. Estadísticas de visitas">
        <p>
          Para saber cuántas personas visitan cada página, nuestro servidor
          registra la página, la dirección IP y el tipo de navegador de cada
          visita. Esto <strong>no usa cookies</strong> ni guarda nada en tu
          navegador, y no se comparte con terceros con fines publicitarios. Más
          detalle en la <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </LegalSection>

      <LegalSection title="4. Servicios externos">
        <p>
          Cuando pagás con <strong>Mercado Pago</strong> o abrís un chat de{' '}
          <strong>WhatsApp</strong>, salís a sus sitios o aplicaciones, que
          usan sus propias cookies según sus políticas. Lo mismo pasa si seguís
          un link a nuestras redes sociales. Eso queda fuera de este sitio.
        </p>
      </LegalSection>

      <LegalSection title="5. Cómo borrarlas o bloquearlas">
        <p>
          Podés borrar las cookies y el almacenamiento local desde la
          configuración de tu navegador (en general, en “Privacidad” o
          “Borrar datos de navegación”). Tené en cuenta que si lo hacés se
          cierra tu sesión y se vacía el carrito; si bloqueás la cookie de
          sesión, no vas a poder entrar a tu cuenta, aunque sí podés seguir
          comprando como invitado.
        </p>
      </LegalSection>

      <LegalSection title="6. Consultas">
        <p>
          Si tenés dudas sobre esto, escribinos
          {contacto.email ? (
            <>
              {' '}a <a href={`mailto:${contacto.email}`}>{contacto.email}</a>.
            </>
          ) : (
            '.'
          )}
        </p>
      </LegalSection>
    </LegalPage>
  );
}
