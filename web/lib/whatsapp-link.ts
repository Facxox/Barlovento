import 'server-only';
import { formatMoney } from '@/components/formatMoney';

type PickupOrderSummary = {
  id: number;
  customer_name: string | null;
  items: Array<{ id: string; name: string; qty: number; price: number; currency: string }>;
  total: number;
  currency: string;
};

/**
 * Arma el link wa.me para que el cliente coordine el retiro de un
 * pedido pagado por Mercado Pago. El mensaje incluye id del pedido,
 * nombre del cliente, líneas del pedido y total pagado.
 *
 * El teléfono se sanitiza para dejar sólo dígitos (wa.me no acepta
 * '+', espacios ni guiones).
 */
export function buildPickupWaLink(
  phone: string,
  order: PickupOrderSummary
): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const lines = order.items
    .map(
      (i) =>
        `· ${i.qty} x ${i.name} — ${formatMoney(i.price * i.qty, i.currency)}`
    )
    .join('\n');

  const msg =
    `Hola Barlovento! Acabo de pagar el pedido #${order.id} y quiero coordinar el RETIRO.\n\n` +
    `Nombre: ${order.customer_name ?? '—'}\n\n` +
    `Pedido:\n${lines}\n\n` +
    `Total pagado: ${formatMoney(order.total, order.currency)}\n\n` +
    `¿Cuándo puedo pasar a retirarlo?\n` +
    `¡Gracias!`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
