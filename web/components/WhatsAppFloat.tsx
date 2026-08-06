'use client';

export default function WhatsAppFloat({ whatsapp }: { whatsapp: string }) {
  const phone = whatsapp.replace(/\D/g, '');
  const msg = encodeURIComponent(
    'Hola Barlovento, quería consultar por los alfajores.'
  );
  return (
    <a
      href={`https://wa.me/${phone}?text=${msg}`}
      target="_blank"
      rel="noopener"
      aria-label="Escribinos por WhatsApp"
      className="group fixed bottom-6 right-6 z-30 flex items-center gap-3 rounded-full bg-[#25D366] pl-4 pr-5 py-3 text-white shadow-2xl shadow-black/40 transition hover:scale-[1.03]"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M19.05 4.91A10 10 0 0 0 4.1 18.16L3 22l3.93-1.03A10 10 0 1 0 19.05 4.91Zm-7.07 15.45a8.31 8.31 0 0 1-4.24-1.16l-.3-.18-2.33.61.62-2.27-.2-.32a8.32 8.32 0 1 1 6.45 3.32Zm4.57-6.24c-.25-.12-1.48-.73-1.71-.81-.23-.08-.4-.12-.57.13-.17.25-.65.82-.8.99-.15.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.24a7.5 7.5 0 0 1-1.39-1.73c-.15-.25-.02-.39.11-.51.11-.11.25-.3.37-.45.12-.15.16-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.57-1.37-.78-1.88-.2-.49-.42-.42-.57-.43h-.49a.94.94 0 0 0-.68.32 2.85 2.85 0 0 0-.89 2.13c0 1.26.91 2.47 1.04 2.64.12.17 1.79 2.74 4.34 3.84.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.48-.61 1.69-1.19.21-.59.21-1.09.15-1.19-.06-.1-.23-.16-.48-.28Z" />
      </svg>
      <span className="hidden sm:inline font-body text-sm font-medium">WhatsApp</span>
    </a>
  );
}
