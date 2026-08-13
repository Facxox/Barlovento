import { getSiteContent } from '@/lib/queries';

export default async function Footer() {
  const { contacto: c } = await getSiteContent();
  // Server-only: el año viene del server, no del cliente, así no hay
  // mismatch si el render cruza la medianoche.
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-carbon-line bg-carbon pt-20 pb-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src="/Logo.jpg"
                alt="Barlovento"
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <p className="font-display text-2xl text-gold leading-none">Barlovento</p>
                <p className="font-body text-[11px] uppercase tracking-ultra text-bone/60 mt-1">Irresistibles</p>
              </div>
            </div>
            <p className="mt-6 max-w-sm prose-editorial text-bone/70">
              Alfajores artesanales elaborados en Trinidad, Flores, Uruguay.
            </p>
          </div>

          <div>
            <p className="text-eyebrow mb-4">Contacto</p>
            <ul className="space-y-2 text-bone/80 font-body text-sm">
              <li><a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} className="gold-underline">WhatsApp</a></li>
              <li><a href={`mailto:${c.email}`} className="gold-underline">{c.email}</a></li>
              <li className="text-bone/60">{c.direccion}</li>
              <li className="text-bone/60">{c.horarios}</li>
            </ul>
          </div>

          <div>
            <p className="text-eyebrow mb-4">Medios de pago</p>
            <ul className="space-y-2 text-bone/80 font-body text-sm">
              <li>Mercado Pago</li>
              <li>Visa · Mastercard</li>
              <li>Transferencias Bancarias</li>
            </ul>
            <p className="text-eyebrow mt-8 mb-4">Redes</p>
            <ul className="space-y-2 text-bone/80 font-body text-sm">
              <li><a href={c.instagram} target="_blank" rel="noopener" className="gold-underline">Instagram</a></li>
              <li><a href={c.facebook} target="_blank" rel="noopener" className="gold-underline">Facebook</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-2 border-t border-carbon-line pt-6 text-bone/50 text-xs font-body md:flex-row md:items-center md:justify-between">
          <p>© {currentYear} Barlovento · Todos los derechos reservados.</p>
          <p className="tracking-ultra uppercase">Trinidad · Flores · Uruguay</p>
        </div>
        <p className="mt-3 text-center font-body text-[11px] text-bone/40 md:text-right">
          Desarrollado por{' '}
          <a
            href="https://zenathia.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold transition-colors hover:text-bone"
          >
            Zenathia
          </a>
        </p>
      </div>
    </footer>
  );
}
