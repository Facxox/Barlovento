import 'server-only';
import { MercadoPagoConfig } from 'mercadopago';

/**
 * Singleton MercadoPago client. Required env: MERCADO_PAGO_ACCESS_TOKEN.
 *
 * Returns null when the token is missing so the storefront can degrade
 * gracefully in dev (the CartDrawer surfaces an inline error).
 */
let client: MercadoPagoConfig | null = null;

export function getMercadoPago(): MercadoPagoConfig | null {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return null;
  if (!client) {
    client = new MercadoPagoConfig({ accessToken: token });
  }
  return client;
}