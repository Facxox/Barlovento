/**
 * Helpers de formato de fecha que NO dependen del locale NI del timezone
 * del runtime.
 *
 * Usar en lugar de toLocaleDateString/toLocaleString en componentes
 * que se renderizan tanto en server como en client, porque el locale
 * del navegador puede diferir del locale del server Node y rompe la
 * hidratación de React.
 *
 * Tampoco alcanza con evitar Intl: `new Date(...).getDate()` usa el
 * timezone del runtime. Vercel corre en UTC y el visitante uruguayo
 * está en UTC-3, así que el server y el browser producían días
 * distintos para la misma fecha (React #425 → #418 → #423). Por eso
 * acá parseamos siempre a partes fijas:
 *
 * - `YYYY-MM-DD` (columna `date` de Postgres) se lee literal: el 15 es
 *   el 15 en todos lados, sin convertir nada.
 * - Los timestamps completos (`timestamptz`) se muestran en la hora de
 *   Uruguay, que es UTC-3 fijo (sin horario de verano desde 2015).
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

/** Uruguay no tiene horario de verano desde 2015: UTC-3 fijo. */
const UY_OFFSET_MINUTES = -180;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = {
  year: number;
  /** 0-11 */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  /** 0-6, domingo = 0 */
  weekday: number;
};

/**
 * Parsea un ISO string a partes que dan el mismo resultado en cualquier
 * runtime, sin importar el TZ del proceso ni del navegador.
 */
export function parseIsoParts(iso: string): DateParts | null {
  const dateOnly = DATE_ONLY.exec(iso);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const utc = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(utc.getTime())) return null;
    return { year, month, day, hours: 0, minutes: 0, weekday: utc.getUTCDay() };
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  // Desplazamos el instante y leemos con getters UTC: así el string es
  // idéntico en el server (UTC) y en el browser (cualquier TZ).
  const shifted = new Date(parsed.getTime() + UY_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** "5 de enero 2026" */
export function formatLongDateEs(iso: string): string {
  const p = parseIsoParts(iso);
  if (!p) return iso;
  return `${p.day} de ${MONTHS_LONG_ES[p.month]} ${p.year}`;
}

/** "05 ene 2026" */
export function formatShortMonthEs(iso: string): string {
  const p = parseIsoParts(iso);
  if (!p) return iso;
  return `${String(p.day).padStart(2, '0')} ${MONTHS_SHORT_ES[p.month]} ${p.year}`;
}

/** "5 ene" (sin año) */
export function formatShortDayEs(iso: string): string {
  const p = parseIsoParts(iso);
  if (!p) return iso;
  return `${p.day} ${MONTHS_SHORT_ES[p.month]}`;
}

/** "lun 5 ene" */
export function formatWeekdayShortEs(iso: string): string {
  const p = parseIsoParts(iso);
  if (!p) return iso;
  return `${WEEKDAYS_ES[p.weekday]} ${p.day} ${MONTHS_SHORT_ES[p.month]}`;
}

/** "dd/mm/yyyy" o "dd/mm/yyyy, hh:mm" */
export function formatIsoShort(iso: string, showTime = false): string {
  const p = parseIsoParts(iso);
  if (!p) return iso;
  const dd = String(p.day).padStart(2, '0');
  const mm = String(p.month + 1).padStart(2, '0');
  if (!showTime) return `${dd}/${mm}/${p.year}`;
  const hh = String(p.hours).padStart(2, '0');
  const mi = String(p.minutes).padStart(2, '0');
  return `${dd}/${mm}/${p.year}, ${hh}:${mi}`;
}
