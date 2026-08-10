/**
 * Componente compartido para formatear fechas en server-rendered
 * components SIN usar Intl.toLocale* (que depende del locale del
 * runtime y rompe la hidratación entre server y client).
 *
 * Server-render siempre produce el mismo string (UTC-naive manual);
 * client-render produce idéntico. Sin mismatches.
 */

type Props = {
  iso: string;
  /** Si true, incluye hora HH:MM. Default: false. */
  showTime?: boolean;
};

export function ShortDate({ iso, showTime = false }: Props) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <>{iso}</>;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return (
    <>{showTime ? `${dd}/${mm}/${yy}, ${hh}:${mi}` : `${dd}/${mm}/${yy}`}</>
  );
}