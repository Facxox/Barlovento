import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteContent } from '@/lib/queries';
import LegalPage, {
  LegalResponsable,
  LegalSection,
  whatsappHref,
} from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Política de privacidad · Barlovento',
  description:
    'Qué datos personales guarda Barlovento, para qué los usa, con quién los comparte y cómo ejercer tus derechos según la Ley 18.331 de Uruguay.',
  alternates: { canonical: '/privacidad' },
};

export default async function PrivacidadPage() {
  const { contacto } = await getSiteContent();

  return (
    <LegalPage
      title="Política de privacidad"
      current="/privacidad"
      intro={
        <p>
          En Barlovento cuidamos los datos que nos confiás. Esta política
          explica qué datos personales recolectamos cuando usás el sitio, para
          qué los usamos, con quién los compartimos y cómo podés ejercer tus
          derechos. Se basa en la Ley 18.331 de Protección de Datos Personales y
          su Decreto reglamentario 414/009.
        </p>
      }
    >
      <LegalSection title="1. Responsable de los datos">
        <p>El responsable de la base de datos y del tratamiento es:</p>
        <LegalResponsable contacto={contacto} />
      </LegalSection>

      <LegalSection title="2. Qué datos recolectamos">
        <ul>
          <li>
            <strong>Si creás una cuenta</strong>: email y contraseña (la
            contraseña se guarda cifrada y nadie del equipo puede verla), y los
            datos que agregues en tu perfil: nombre completo, teléfono,
            dirección y ciudad.
          </li>
          <li>
            <strong>Cuando hacés un pedido</strong>: nombre, email, teléfono,
            dirección y ciudad de entrega (si elegís envío), los productos, el
            total, el cupón que uses y el estado del pago.
          </li>
          <li>
            <strong>Si pagás por transferencia</strong>: el comprobante que
            subas (imagen o PDF), que puede incluir tu nombre, banco y número
            de cuenta.
          </li>
          <li>
            <strong>Si pagás con Mercado Pago</strong>: recibimos de Mercado
            Pago el número de operación y el estado del pago. Los datos de tu
            tarjeta los procesa Mercado Pago y <strong>nunca llegan a
            nosotros</strong>.
          </li>
          <li>
            <strong>Si dejás una opinión</strong>: tu calificación, tu
            comentario y el nombre de tu perfil, que se publica junto a la
            opinión.
          </li>
          <li>
            <strong>Si nos escribís por WhatsApp o email</strong>: tu número o
            dirección y lo que nos cuentes en la conversación.
          </li>
          <li>
            <strong>Datos técnicos de navegación</strong>: para saber cuántas
            visitas recibe cada página, registramos la página visitada, la
            dirección IP, el tipo de navegador y un identificador anónimo
            generado a partir de esos datos. No los usamos para publicidad ni
            para armar perfiles.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para qué los usamos">
        <ul>
          <li>Procesar, preparar, cobrar y entregar tus pedidos.</li>
          <li>
            Comunicarnos con vos sobre tu pedido: confirmaciones, coordinación
            del envío o retiro, demoras o cambios.
          </li>
          <li>
            Gestionar tu cuenta y mostrarte tu historial de compras.
          </li>
          <li>
            Aplicar cupones y condiciones de cliente mayorista, si corresponde.
          </li>
          <li>Atender consultas, reclamos, cambios y devoluciones.</li>
          <li>
            Cumplir obligaciones legales, contables y tributarias.
          </li>
          <li>
            Conocer de forma agregada cómo se usa el sitio, para mejorarlo y
            mantenerlo seguro.
          </li>
        </ul>
        <p>
          No vendemos ni alquilamos tus datos. No te mandamos publicidad por
          email o WhatsApp sin tu consentimiento, y si alguna vez lo das, podés
          retirarlo cuando quieras.
        </p>
      </LegalSection>

      <LegalSection title="4. Base legal">
        <p>
          Tratamos tus datos porque son necesarios para cumplir la compra que
          nos pedís (relación contractual), para cumplir obligaciones legales, y
          en lo demás, con tu consentimiento, que das al registrarte, al hacer
          un pedido o al escribirnos, según el artículo 9 de la Ley 18.331.
        </p>
      </LegalSection>

      <LegalSection title="5. Con quién los compartimos">
        <p>
          Solo compartimos tus datos con proveedores que necesitamos para que el
          sitio y la tienda funcionen. Actúan como encargados del tratamiento:
          usan los datos solo para darnos su servicio.
        </p>
        <ul>
          <li>
            <strong>Supabase</strong>: base de datos, autenticación de cuentas y
            almacenamiento de archivos (por ejemplo, comprobantes de
            transferencia).
          </li>
          <li>
            <strong>Vercel</strong>: alojamiento y funcionamiento del sitio web.
          </li>
          <li>
            <strong>Mercado Pago</strong>: procesamiento de pagos. Al pagar por
            esa vía también aplican sus propias políticas de privacidad.
          </li>
          <li>
            <strong>WhatsApp (Meta)</strong>: cuando elegís comunicarte o
            enviarnos tu pedido por WhatsApp, la conversación pasa por ese
            servicio y se rige también por sus políticas.
          </li>
          <li>
            <strong>Servicios de envío</strong>: les pasamos nombre, teléfono y
            dirección para que puedan entregarte el pedido.
          </li>
        </ul>
        <p>
          Además, podemos comunicar datos a autoridades públicas cuando una ley
          o una orden judicial lo exija.
        </p>
      </LegalSection>

      <LegalSection title="6. Transferencia internacional">
        <p>
          Algunos de estos proveedores (Supabase, Vercel y Meta, entre otros)
          pueden guardar o procesar datos en servidores ubicados fuera de
          Uruguay, por ejemplo en Estados Unidos. Elegimos proveedores
          reconocidos que aplican medidas de seguridad y compromisos
          contractuales de protección de datos, conforme al artículo 23 de la
          Ley 18.331. Al usar el sitio, consentís esa transferencia, que es
          necesaria para prestarte el servicio.
        </p>
      </LegalSection>

      <LegalSection title="7. Cuánto tiempo los guardamos">
        <ul>
          <li>
            <strong>Datos de cuenta</strong>: mientras tu cuenta esté activa. Si
            pedís la baja, la eliminamos.
          </li>
          <li>
            <strong>Pedidos y comprobantes</strong>: el tiempo que exijan las
            normas contables y tributarias, y el necesario para atender
            reclamos o garantías.
          </li>
          <li>
            <strong>Opiniones</strong>: mientras estén publicadas o hasta que
            nos pidas sacarlas.
          </li>
          <li>
            <strong>Registros de visitas</strong>: solo el tiempo necesario para
            elaborar estadísticas del sitio.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Seguridad">
        <p>
          Usamos conexiones cifradas (HTTPS), contraseñas cifradas, acceso
          restringido al panel de administración y reglas de acceso en la base
          de datos para que cada cliente vea solo sus propios pedidos. Ningún
          sistema es infalible, pero si detectamos un incidente que afecte tus
          datos, te vamos a avisar y lo vamos a informar a la autoridad según
          corresponda.
        </p>
      </LegalSection>

      <LegalSection title="9. Tus derechos">
        <p>
          Como titular de tus datos tenés derecho a:
        </p>
        <ul>
          <li>
            <strong>Acceso</strong>: saber qué datos tuyos tenemos.
          </li>
          <li>
            <strong>Rectificación y actualización</strong>: corregir datos
            equivocados o desactualizados. Muchos los podés cambiar vos mismo
            desde <Link href="/mi-cuenta">Mi cuenta</Link>.
          </li>
          <li>
            <strong>Supresión</strong>: pedir que borremos tus datos, salvo los
            que tengamos que conservar por ley.
          </li>
          <li>
            <strong>Inclusión</strong> y <strong>oposición</strong> a ciertos
            usos, y a retirar tu consentimiento cuando quieras.
          </li>
        </ul>
        <p>
          Para ejercerlos, escribinos
          {contacto.email && (
            <>
              {' '}a <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
            </>
          )}
          {contacto.whatsapp && (
            <>
              {' '}o por{' '}
              <a href={whatsappHref(contacto.whatsapp)} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </>
          )}
          , indicando qué querés hacer. Podemos pedirte que acredites tu
          identidad (por ejemplo, escribiendo desde el email de tu cuenta). Es
          gratuito y te respondemos dentro de los{' '}
          <strong>5 días hábiles</strong> que fija la Ley 18.331.
        </p>
        <p>
          Si no te respondemos en plazo o no quedás conforme, podés presentar
          una denuncia ante la{' '}
          <strong>
            Unidad Reguladora y de Control de Datos Personales (URCDP)
          </strong>
          , el órgano de control en Uruguay:{' '}
          <a href="https://www.gub.uy/unidad-reguladora-control-datos-personales" target="_blank" rel="noopener noreferrer">
            gub.uy/urcdp
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Menores de edad">
        <p>
          La tienda está pensada para mayores de 18 años. Si sos menor, pedile a
          un adulto responsable que haga la compra. No recolectamos a
          sabiendas datos de menores; si nos enteramos de que pasó, los
          borramos.
        </p>
      </LegalSection>

      <LegalSection title="11. Cookies y almacenamiento local">
        <p>
          Lo que el sitio guarda en tu navegador (la sesión de tu cuenta y el
          carrito) está explicado en{' '}
          <Link href="/cookies">Cookies y almacenamiento</Link>.
        </p>
      </LegalSection>

      <LegalSection title="12. Cambios en esta política">
        <p>
          Si cambiamos esta política, publicamos la nueva versión acá con su
          fecha de actualización. Si el cambio es importante, también lo vamos
          a avisar en el sitio.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
