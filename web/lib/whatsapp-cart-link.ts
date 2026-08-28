import { formatMoney } from '@/components/formatMoney';

/**
 * Política de envío fijo (UYU). Coincide con las constantes en
 * app/checkout/CheckoutForm.tsx y app/api/checkout/route.ts.
 * La fuente de verdad es el server.
 */
export const SHIPPING_LE_20 = 195;
export const SHIPPING_MAS_20 = 220;
export const SHIPPING_THRESHOLD = 20;

export function calcShippingCost(alfajores: number): number {
  if (alfajores <= 0) return 0;
  return alfajores > SHIPPING_THRESHOLD ? SHIPPING_MAS_20 : SHIPPING_LE_20;
}

export type CartLineForWa = {
  qty: number;
  name: string;
  price: number;
  currency?: string;
  unitsPerPack?: number;
};

export type BuildCartWaParams = {
  items: CartLineForWa[];
  shippingPreview: number;
  alfajores: number;
  currency: string;
  phone: string;
  /** Cuando true, agrega "Mayorista:" al inicio del mensaje. */
  isWholesale?: boolean;
};

/**
 * Arma el link de WhatsApp con el resumen del carrito.
 * Es client-safe (sin 'server-only'): lo usan tanto CartDrawer como
 * CheckoutForm para el flujo mayorista.
 *
 * El formato del mensaje se mantiene EXACTO al que ya usaba
 * CartDrawer.tsx (buildWhatsAppLink local) para no introducir drift en
 * los mensajes que recibe hoy el admin.
 */
export function buildCartWhatsAppLink(params: BuildCartWaParams): string {
  const { items, shippingPreview, alfajores, currency, phone, isWholesale } =
    params;
  const cleanPhone = phone.replace(/\D/g, '');
  const lines = items
    .map(
      (i) =>
        `· ${i.qty} x ${i.name} — ${formatMoney(i.price * i.qty, i.currency ?? currency)}`
    )
    .join('\n');
  const shippingLine =
    shippingPreview > 0
      ? `\n· Envío (${alfajores} alfajor${alfajores === 1 ? '' : 'es'}) — ${formatMoney(shippingPreview, currency)}`
      : '';
  const total = items.reduce((acc, i) => acc + i.price * i.qty, 0) + shippingPreview;
  const wholesalePrefix = isWholesale ? 'Hola Barlovento! Soy mayorista y quiero hacer este pedido:' : 'Hola Barlovento! Quiero hacer este pedido:';
  const msg = encodeURIComponent(
    `${wholesalePrefix}\n\n${lines}${shippingLine}\n\nTotal: ${formatMoney(total, currency)}\n\nGracias!`
  );
  return `https://wa.me/${cleanPhone}?text=${msg}`;
}
