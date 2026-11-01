import Link from 'next/link';
import type { SiteContent } from '@/lib/queries';

/**
 * Plantilla compartida de las páginas legales (/terminos, /privacidad,
 * /cookies, /cambios-y-devoluciones). Usa los mismos tokens del sitio
 * (carbon, bone, gold, text-eyebrow, font-display) para que se vean
 * como el resto de la web.
 */

export const LEGAL_UPDATED_AT = '1 de noviembre de 2026';

// ------------------------------------------------------------------
// DATOS A COMPLETAR: razón social y RUT del titular del comercio.
// Es el único lugar donde están; todas las páginas legales los toman
// de acá. Reemplazar los textos entre corchetes cuando se tengan.
// ------------------------------------------------------------------
export const LEGAL_RAZON_SOCIAL = '[Razón social a completar]';
export const LEGAL_RUT = '[RUT a completar]';

const LEGAL_LINKS = [
  { href: '/terminos', label: 'Términos y condiciones' },
  { href: '/privacidad', label: 'Política de privacidad' },
  { href: '/cookies', label: 'Cookies y almacenamiento' },
  { href: '/cambios-y-devoluciones', label: 'Cambios y devoluciones' },
];

type Contacto = SiteContent['contacto'];

export function whatsappHref(whatsapp: string) {
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
}

export default function LegalPage({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-screen bg-carbon px-6 py-28 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-eyebrow">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-bone md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 font-body text-xs uppercase tracking-ultra text-bone/50">
          Última actualización: {LEGAL_UPDATED_AT}
        </p>
        {intro && (
          <div className="mt-8 font-body text-base leading-[1.85] text-bone/85 md:text-lg">
            {intro}
          </div>
        )}

        <div className="mt-12 space-y-12">{children}</div>

        <nav
          aria-label="Páginas legales"
          className="mt-16 border-t border-carbon-line pt-8"
        >
          <p className="text-eyebrow mb-4">Más información legal</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-3 font-body text-sm text-bone/70">
            {LEGAL_LINKS.filter((l) => l.href !== current).map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="gold-underline hover:text-bone">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 font-body text-xs leading-relaxed text-bone/40">
            Este texto es informativo y se rige por la normativa de la República
            Oriental del Uruguay. Ante cualquier diferencia, prevalece lo que
            dispone la ley.
          </p>
        </nav>
      </div>
    </section>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl font-light text-gold md:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 font-body text-[15px] leading-[1.8] text-bone/80 md:text-base [&_a]:text-gold [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-bone [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-bone [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-gold">
        {children}
      </div>
    </section>
  );
}

/** Bloque con los datos del titular, usado en varias páginas. */
export function LegalResponsable({ contacto }: { contacto: Contacto }) {
  return (
    <div className="rounded-md border border-carbon-line bg-carbon-raised p-5 font-body text-sm leading-relaxed text-bone/80 md:p-6">
      <ul className="!list-none !space-y-1 !pl-0">
        <li>
          <strong>Nombre comercial:</strong> Barlovento
        </li>
        <li>
          <strong>Razón social:</strong> {LEGAL_RAZON_SOCIAL}
        </li>
        <li>
          <strong>RUT:</strong> {LEGAL_RUT}
        </li>
        <li>
          <strong>Domicilio:</strong> {contacto.direccion || 'Trinidad, Flores, Uruguay'}
        </li>
        {contacto.email && (
          <li>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
          </li>
        )}
        {contacto.whatsapp && (
          <li>
            <strong>WhatsApp:</strong>{' '}
            <a href={whatsappHref(contacto.whatsapp)} target="_blank" rel="noopener noreferrer">
              {contacto.whatsapp}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
