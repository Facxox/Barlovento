/**
 * Formato de moneda determinístico: produce exactamente el mismo string
 * en el server y en el browser.
 *
 * No usamos Intl.NumberFormat porque la tabla CLDR de Node y la del
 * navegador pueden diferir (separador de miles, espacio duro, posición
 * del símbolo). Cualquier diferencia en un componente cliente rompe la
 * hidratación de React (#425 → #418 → #423).
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  UYU: '$',
  USD: 'US$',
  ARS: 'AR$',
  BRL: 'R$',
  CLP: 'CLP',
  MXN: 'MX$',
  COP: 'COL$',
  PEN: 'S/',
};

/** Entero con separador de miles es-UY: 1250 → "1.250" */
export function formatAmount(n: number): string {
  const rounded = Math.round(Number.isFinite(n) ? n : 0);
  const sign = rounded < 0 ? '-' : '';
  return (
    sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  );
}

/** "$ 1.250" — espacio duro entre símbolo y monto, como el formato es-UY. */
export function formatMoney(n: number, currency = 'UYU'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}\u00a0${formatAmount(n)}`;
}
