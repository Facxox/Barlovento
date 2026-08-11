/**
 * Componente compartido para formatear fechas en server-rendered
 * components SIN usar Intl.toLocale* (que depende del locale del
 * runtime y rompe la hidratación entre server y client).
 *
 * Delega en formatIsoShort, que además fija el timezone (UTC-3) para
 * que el server y el browser produzcan siempre el mismo string.
 */

import { formatIsoShort } from './formatDate';

type Props = {
  iso: string;
  /** Si true, incluye hora HH:MM. Default: false. */
  showTime?: boolean;
};

export function ShortDate({ iso, showTime = false }: Props) {
  return <>{formatIsoShort(iso, showTime)}</>;
}
