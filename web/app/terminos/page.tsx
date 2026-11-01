import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteContent } from '@/lib/queries';
import LegalPage, {
  LegalResponsable,
  LegalSection,
  whatsappHref,
} from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Términos y condiciones · Barlovento',
  description:
    'Condiciones de uso del sitio y de compra de alfajores artesanales Barlovento: pedidos, precios, pagos, envíos, cuentas y ley aplicable en Uruguay.',
  alternates: { canonical: '/terminos' },
};

export default async function TerminosPage() {
  const { contacto } = await getSiteContent();

  return (
    <LegalPage
      title="Términos y condiciones"
      current="/terminos"
      intro={
        <p>
          Estos términos regulan el uso de este sitio y las compras que hacés en
          la tienda online de Barlovento, alfajores artesanales elaborados en
          Trinidad, Flores. Al navegar el sitio, crear una cuenta o hacer un
          pedido, aceptás estas condiciones. Si algo no te cierra, escribinos
          antes de comprar.
        </p>
      }
    >
      <LegalSection title="1. Quiénes somos">
        <p>El sitio y la tienda son operados por:</p>
        <LegalResponsable contacto={contacto} />
        {contacto.horarios && (
          <p>Horario de atención: {contacto.horarios}.</p>
        )}
      </LegalSection>

      <LegalSection title="2. Productos">
        <p>
          Vendemos alfajores y otros productos de elaboración artesanal, sueltos,
          en cajas o en contenedores que podés armar a tu gusto, además de
          artículos de merchandising. Las fotos son ilustrativas: al ser
          productos hechos a mano, puede haber pequeñas diferencias de forma,
          tamaño o terminación que no afectan la calidad.
        </p>
        <p>
          En la ficha de cada producto publicamos los ingredientes, la
          información nutricional y los rotulados frontales que correspondan
          (por ejemplo, “Exceso azúcar” o “Exceso grasas”). Si tenés alergias o
          alguna intolerancia, revisá esa información y, ante la duda,
          consultanos antes de comprar: en el obrador se manipulan ingredientes
          como leche, trigo, huevo y maní, y no podemos garantizar la ausencia
          de trazas.
        </p>
        <p>
          Los productos se ofrecen hasta agotar stock. Si después de confirmado
          un pedido nos quedamos sin algún producto, te avisamos para cambiarlo
          por otro de igual valor o devolverte lo que corresponda.
        </p>
      </LegalSection>

      <LegalSection title="3. Precios">
        <ul>
          <li>
            Todos los precios están expresados en <strong>pesos uruguayos
            (UYU)</strong> e incluyen los impuestos que correspondan.
          </li>
          <li>
            El costo de envío se muestra aparte, antes de pagar, y se suma al
            total del pedido.
          </li>
          <li>
            El precio que vale es el que figura en el sitio al momento de
            confirmar tu pedido. Podemos cambiar precios y promociones en
            cualquier momento, pero el cambio no afecta pedidos ya confirmados.
          </li>
          <li>
            Si por un error evidente un producto aparece con un precio
            claramente equivocado, te vamos a contactar antes de procesar el
            pedido para que decidas si seguís con el precio correcto o lo
            cancelás con devolución total.
          </li>
          <li>
            Los cupones de descuento tienen las condiciones que se indiquen en
            cada caso (vigencia, monto mínimo, tipo de cliente), no son
            acumulables salvo que se diga lo contrario y no se canjean por
            dinero.
          </li>
          <li>
            Los clientes mayoristas pueden tener precios y condiciones propias,
            que se acuerdan con cada uno.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Cómo funciona un pedido">
        <ul>
          <li>Agregás productos al carrito y vas al checkout.</li>
          <li>
            Completás tus datos de contacto y elegís si querés{' '}
            <strong>envío a domicilio</strong> o <strong>retiro coordinado
            por WhatsApp</strong>.
          </li>
          <li>
            Revisás el resumen (productos, envío, descuentos y total), aceptás
            las condiciones del envío y elegís cómo pagar.
          </li>
          <li>
            El pedido queda <strong>confirmado cuando se acredita el pago</strong>{' '}
            (en Mercado Pago) o cuando verificamos la transferencia. Hasta ese
            momento, no reservamos stock.
          </li>
          <li>
            También podés armar tu pedido y enviárnoslo por WhatsApp; en ese
            caso, el pedido se confirma cuando lo acordamos por ese medio.
          </li>
        </ul>
        <p>
          Sos responsable de que los datos que cargás (nombre, teléfono, email y
          dirección) sean correctos. Si la entrega falla por un dato mal
          ingresado, el nuevo envío puede tener costo.
        </p>
      </LegalSection>

      <LegalSection title="5. Medios de pago">
        <ul>
          <li>
            <strong>Mercado Pago</strong>: tarjetas de crédito y débito (Visa,
            Mastercard y otras), saldo en cuenta y los medios que Mercado Pago
            habilite. El pago se procesa en la plataforma de Mercado Pago:
            nosotros nunca vemos ni guardamos los datos de tu tarjeta.
          </li>
          <li>
            <strong>Transferencia bancaria</strong>: te mostramos los datos de
            la cuenta y podés subir el comprobante. El pedido se prepara cuando
            confirmamos que el dinero ingresó.
          </li>
        </ul>
        <p>
          Las cuotas, recargos o promociones bancarias dependen de Mercado Pago y
          de tu banco, no de Barlovento.
        </p>
      </LegalSection>

      <LegalSection title="6. Envíos y retiros">
        <ul>
          <li>
            Hacemos envíos a todo el Uruguay. El costo es fijo y depende de la
            cantidad de productos del pedido; el monto exacto lo ves en el
            checkout antes de pagar.
          </li>
          <li>
            Los plazos de entrega son estimados y pueden variar según la
            localidad, el servicio de envío y la época del año (feriados,
            fechas especiales). Te avisamos si hay demoras.
          </li>
          <li>
            Si elegís retiro, coordinamos el día y el lugar por WhatsApp después
            del pago.
          </li>
          <li>
            Al recibir el paquete, revisalo. Si llega dañado o con algún
            problema, avisanos lo antes posible (ver{' '}
            <Link href="/cambios-y-devoluciones">Cambios y devoluciones</Link>
            ).
          </li>
          <li>
            Nuestros alfajores son alimentos: conservalos en un lugar fresco y
            seco, lejos del sol, y consumilos antes de la fecha indicada en el
            envase.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Cancelaciones, cambios y devoluciones">
        <p>
          Podés cancelar un pedido sin costo mientras no lo hayamos despachado
          o preparado. Las condiciones para cambios y devoluciones, incluido el
          derecho de arrepentimiento previsto en la Ley 17.250 y su alcance para
          alimentos perecederos, están en{' '}
          <Link href="/cambios-y-devoluciones">Cambios y devoluciones</Link>.
        </p>
      </LegalSection>

      <LegalSection title="8. Tu cuenta">
        <ul>
          <li>
            Crear una cuenta es opcional. Te sirve para guardar tus datos de
            envío y ver el historial de tus pedidos.
          </li>
          <li>
            Sos responsable de cuidar tu contraseña y de lo que se haga con tu
            cuenta. Si creés que alguien entró sin permiso, cambiá la contraseña
            y avisanos.
          </li>
          <li>
            Podés pedir la baja de tu cuenta en cualquier momento escribiéndonos.
          </li>
          <li>
            Podemos suspender cuentas que se usen para fraudes, para cargar
            información falsa o para afectar el funcionamiento del sitio.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Opiniones de clientes">
        <p>
          Si dejás una opinión sobre un producto, se publica con tu nombre y tu
          calificación una vez que la revisamos. Pedimos que sea respetuosa y
          sobre tu experiencia real. No publicamos opiniones con insultos, datos
          personales de terceros, publicidad o contenido ilegal.
        </p>
      </LegalSection>

      <LegalSection title="10. Propiedad intelectual">
        <p>
          La marca Barlovento, el logo, las fotos, los textos, el diseño del
          sitio y las recetas son de Barlovento o se usan con autorización. No
          podés copiarlos, reproducirlos ni usarlos con fines comerciales sin
          nuestro permiso por escrito. Compartir links o publicaciones de
          nuestras redes, citando la fuente, está más que bienvenido.
        </p>
      </LegalSection>

      <LegalSection title="11. Uso del sitio y responsabilidad">
        <p>
          Hacemos lo posible para que el sitio funcione bien y la información
          esté al día, pero puede haber interrupciones o errores puntuales. No
          respondemos por fallas de servicios de terceros (conexión a internet,
          Mercado Pago, servicios de mensajería o de envío), sin perjuicio de
          los derechos que te da la ley como consumidor, que no se limitan por
          estos términos.
        </p>
      </LegalSection>

      <LegalSection title="12. Datos personales">
        <p>
          Tratamos tus datos según la Ley 18.331 de Protección de Datos
          Personales. Cómo lo hacemos está explicado en la{' '}
          <Link href="/privacidad">Política de privacidad</Link>, y lo que el
          sitio guarda en tu navegador, en{' '}
          <Link href="/cookies">Cookies y almacenamiento</Link>.
        </p>
      </LegalSection>

      <LegalSection title="13. Cambios en estos términos">
        <p>
          Podemos actualizar estos términos. La versión vigente es la publicada
          en esta página, con su fecha de actualización. Los cambios no se
          aplican a pedidos ya confirmados.
        </p>
      </LegalSection>

      <LegalSection title="14. Ley aplicable y reclamos">
        <p>
          Estos términos se rigen por las leyes de la República Oriental del
          Uruguay, en especial la Ley 17.250 de Relaciones de Consumo. Ante
          cualquier problema, escribinos primero
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
          : la mayoría de las cosas se resuelven rápido. Si no quedás conforme,
          podés recurrir al Área de Defensa del Consumidor del Ministerio de
          Economía y Finanzas (consumidor.gub.uy) y, en su caso, a los
          tribunales competentes de Uruguay.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
