/**
 * Helpers de formato de fecha que NO dependen del locale del runtime.
 *
 * Usar en lugar de toLocaleDateString/toLocaleString en componentes
 * que se renderizan tanto en server como en client, porque el locale
 * del navegador puede diferir del locale del server Node y rompe la
 * hidratación de React.
 *
 * Si necesitás un locale específico, exportalo explícitamente.
 */

const MONTHS_LONG_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const MONTHS_SHORT_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const WEEKDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "5 de enero 2026" */
export function formatLongDateEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} de ${MONTHS_LONG_ES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "05 ene 2026" */
export function formatShortMonthEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT_ES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 ene" (sin año) */
export function formatShortDayEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_SHORT_ES[d.getMonth()]}`;
}

/** "lun 5 ene" */
export function formatWeekdayShortEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT_ES[d.getMonth()]}`;
}

/** "dd/mm/yyyy" o "dd/mm/yyyy, hh:mm" */
export function formatIsoShort(iso: string, showTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  if (!showTime) return `${dd}/${mm}/${yy}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy}, ${hh}:${mi}`;
}