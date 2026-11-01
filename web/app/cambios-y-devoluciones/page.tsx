import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteContent } from '@/lib/queries';
import LegalPage, { LegalSection, whatsappHref } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Cambios y devoluciones · Barlovento',
  description:
    'Cómo funcionan los cambios y devoluciones en Barlovento: productos con defecto, derecho de arrepentimiento de la Ley 17.250 y su alcance para alimentos perecederos.',
  alternates: { canonical: '/cambios-y-devoluciones' },
};

export default async function CambiosPage() {
  const { contacto } = await getSiteContent();

  const contactLinks = (
    <>
      {contacto.whatsapp && (
        <a href={whatsappHref(contacto.whatsapp)} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      )}
      {contacto.whatsapp && contacto.email && ' o a '}
      {contacto.email && (
        <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
      )}
    </>
  );

  return (
    <LegalPage
      title="Cambios y devoluciones"
      current="/cambios-y-devoluciones"
      intro={
        <p>
          Nuestros alfajores son alimentos artesanales, frescos y perecederos.
          Por eso las reglas de cambios y devoluciones son distintas a las de
          otros productos: no podemos recibir de vuelta un alimento que ya
          estuvo fuera de nuestro control, pero si algo llega mal,{' '}
          <strong className="font-medium text-bone">lo solucionamos siempre</strong>.
          Acá te contamos cómo.
        </p>
      }
    >
      <LegalSection title="1. Si tu pedido llega con un problema">
        <p>
          Si recibís un producto <strong>dañado, en mal estado, vencido,
          distinto al que pediste o incompleto</strong>, tenés derecho a que lo
          resolvamos sin costo para vos. Podés elegir:
        </p>
        <ul>
          <li>que te lo cambiemos por el mismo producto en buen estado,</li>
          <li>que lo cambiemos por otro de valor equivalente, o</li>
          <li>que te devolvamos el dinero de ese producto (y del envío, si corresponde).</li>
        </ul>
        <p>Para hacerlo, escribinos por {contactLinks} con:</p>
        <ul>
          <li>tu nombre y el número o la fecha del pedido,</li>
          <li>
            fotos del producto, del envase y, si se ve, de la fecha de
            vencimiento y el lote,
          </li>
          <li>una breve descripción de lo que pasó.</li>
        </ul>
        <p>
          Te pedimos que nos avises <strong>dentro de las 48 horas</strong> de
          recibido el pedido, así podemos revisar el caso mientras el producto
          está fresco. Esto es para resolverlo más rápido y no limita los
          derechos que te da la ley como consumidor. Si el problema es de
          calidad, no hace falta que nos devuelvas el producto salvo que te lo
          pidamos; en ese caso, coordinamos el retiro sin costo.
        </p>
      </LegalSection>

      <LegalSection title="2. Derecho de arrepentimiento (Ley 17.250)">
        <p>
          El <strong>artículo 16 de la Ley 17.250</strong> de Relaciones de
          Consumo establece que, en las compras hechas fuera del local
          comercial (por internet, teléfono o WhatsApp, por ejemplo), podés
          arrepentirte y dejar sin efecto la compra dentro de los{' '}
          <strong>5 días hábiles</strong> siguientes a la compra o a la entrega
          del producto, a tu elección, sin tener que dar explicaciones y sin
          ningún costo ni penalidad.
        </p>
        <p>Para ejercerlo:</p>
        <ul>
          <li>
            Avisanos dentro del plazo por un medio que deje constancia: un
            mensaje de WhatsApp o un email a{' '}
            {contacto.email ? (
              <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
            ) : (
              'nuestro correo'
            )}{' '}
            diciendo que te arrepentís de la compra e indicando tu pedido.
          </li>
          <li>
            Si todavía no lo despachamos, cancelamos el pedido y listo.
          </li>
          <li>
            Si ya lo recibiste, tenés que devolvernos el producto{' '}
            <strong>en las mismas condiciones en que lo recibiste</strong>. Te
            indicamos cómo y dónde.
          </li>
          <li>
            Te devolvemos <strong>todo lo que pagaste</strong> por el mismo
            medio de pago (reversión en Mercado Pago o transferencia a tu
            cuenta), sin demoras una vez recibido el aviso y, en su caso, el
            producto.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Qué pasa con los alimentos perecederos">
        <p>
          La ley exige que, al arrepentirte, el producto vuelva{' '}
          <strong>en las mismas condiciones</strong> en que lo entregamos. En el
          caso de un alimento esto tiene consecuencias concretas, que queremos
          explicarte con claridad:
        </p>
        <ul>
          <li>
            Podemos aceptar la devolución solo si el producto está{' '}
            <strong>cerrado, sin abrir, con su envase original intacto</strong>,
            dentro de su fecha de vencimiento y conservado como se indica (lugar
            fresco y seco, lejos del sol y del calor).
          </li>
          <li>
            <strong>No podemos aceptar</strong> productos abiertos,
            consumidos total o parcialmente, con el envase dañado por el
            cliente, mal conservados o vencidos, porque ya no están en las
            condiciones en que se entregaron.
          </li>
          <li>
            Por razones de higiene y seguridad alimentaria,{' '}
            <strong>un alimento devuelto no se vuelve a vender</strong>: se
            descarta.
          </li>
        </ul>
        <p>
          Por eso, fuera del derecho de arrepentimiento y de los casos de
          productos con problemas del punto 1,{' '}
          <strong>no hacemos cambios ni devoluciones de alimentos</strong> por
          gusto, sabor o porque cambiaste de idea. Si tenés dudas sobre qué
          sabor elegir, escribinos antes de comprar y te ayudamos.
        </p>
      </LegalSection>

      <LegalSection title="4. Pedidos personalizados y por encargo">
        <p>
          Los pedidos hechos a medida (por ejemplo, regalos empresariales con
          personalización, cajas armadas especialmente o grandes cantidades
          elaboradas por encargo) se preparan especialmente para vos. Antes de
          empezar a elaborarlos te confirmamos los detalles, el precio y las
          condiciones de cancelación por escrito.
        </p>
      </LegalSection>

      <LegalSection title="5. Merchandising y otros productos no alimenticios">
        <p>
          Los productos que no son alimentos (por ejemplo, merchandising) se
          pueden cambiar o devolver dentro del plazo del derecho de
          arrepentimiento, sin uso y en su empaque original. Si tienen un
          defecto, se aplica lo del punto 1.
        </p>
      </LegalSection>

      <LegalSection title="6. Cancelar un pedido antes del envío">
        <p>
          Si todavía no despachamos tu pedido, podés cancelarlo sin costo
          escribiéndonos por {contactLinks}. Te devolvemos el dinero por el
          mismo medio con el que pagaste. Los tiempos de acreditación de
          reversiones en tarjeta dependen de Mercado Pago y de tu banco.
        </p>
      </LegalSection>

      <LegalSection title="7. Más información">
        <p>
          Estas condiciones complementan los{' '}
          <Link href="/terminos">Términos y condiciones</Link>. Si no llegamos a
          un acuerdo, podés acudir al Área de Defensa del Consumidor
          (consumidor.gub.uy).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
