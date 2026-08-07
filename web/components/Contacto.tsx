'use client';

import { useState } from 'react';
import GoldDivider from './GoldDivider';
import { Reveal } from './Reveal';
import type { SiteContent } from '@/lib/queries';

export default function Contacto({
  contacto,
  mayoristas,
}: {
  contacto: SiteContent['contacto'];
  mayoristas: SiteContent['mayoristas'];
}) {
  const c = contacto;
  const m = mayoristas;
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return;
    const lines = [
      `Hola Barlovento!`,
      ``,
      `Mi nombre es ${form.name.trim()}.`,
      form.email.trim() ? `Email: ${form.email.trim()}` : null,
      ``,
      `${form.message.trim()}`,
    ].filter((l): l is string => l !== null);
    const text = encodeURIComponent(lines.join('\n'));
    const phone = c.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener');
    setSent(true);
    setForm({ name: '', email: '', message: '' });
    setTimeout(() => setSent(false), 3500);
  };

  return (
    <section id="contacto" className="bg-carbon py-28 lg:py-40">
      <GoldDivider />

      <div className="mx-auto grid max-w-7xl gap-16 px-6 pt-24 lg:grid-cols-2 lg:px-10">
        <Reveal>
          <div>
            <p className="text-eyebrow">Contacto</p>
            <h2 className="mt-5 h-section">
              Escribinos, o pasá por el obrador.
            </h2>
            <p className="mt-6 prose-editorial max-w-md">
              Respondemos a la mayor brevedad. Para pedidos grandes
              o catering, preferimos WhatsApp.
            </p>

            <dl className="mt-12 space-y-6">
              <Row label="WhatsApp">
                <a
                  href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                  className="gold-underline font-display text-2xl text-bone"
                >
                  {c.whatsapp}
                </a>
              </Row>
              <Row label="Email">
                <a href={`mailto:${c.email}`} className="gold-underline font-body text-bone">
                  {c.email}
                </a>
              </Row>
              <Row label="Instagram">
                <a href={c.instagram} target="_blank" rel="noreferrer" className="gold-underline font-body text-bone">
                  @barloventouy
                </a>
              </Row>
              <Row label="Facebook">
                <a href={c.facebook} target="_blank" rel="noreferrer" className="gold-underline font-body text-bone">
                  @barloventouy
                </a>
              </Row>
              <Row label="Dirección">
                <span className="text-bone/80 font-body">{c.direccion}</span>
              </Row>
              <Row label="Horarios">
                <span className="text-bone/80 font-body">{c.horarios}</span>
              </Row>
            </dl>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <form onSubmit={onSubmit} className="space-y-5">
            <Field
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              required
            />
            <Field
              label="Mensaje"
              textarea
              value={form.message}
              onChange={(v) => setForm({ ...form, message: v })}
              required
            />

            <button
              type="submit"
              className="group inline-flex items-center gap-3 rounded-full bg-gold px-7 py-3.5 font-body text-sm font-medium text-carbon transition hover:bg-gold-light"
            >
              Enviar mensaje
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>

            {sent && (
              <p className="font-body text-sm text-gold animate-fade-up">
                Listo. Te respondemos pronto.
              </p>
            )}
          </form>
        </Reveal>
      </div>

      {/* Mayoristas / Comercio */}
      <div className="mx-auto mt-28 max-w-7xl border-t border-carbon-line px-6 pt-20 lg:px-10">
        <Reveal>
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-eyebrow">{m.eyebrow}</p>
              <h2 className="mt-5 h-section">{m.headline}</h2>
              <p className="mt-6 prose-editorial max-w-md">{m.intro}</p>
              <a
                href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola! Quiero ser punto de venta de Barlovento.')}`}
                target="_blank"
                rel="noreferrer"
                className="group mt-8 inline-flex items-center gap-3 rounded-full bg-gold px-7 py-3.5 font-body text-sm font-medium text-carbon transition hover:bg-gold-light"
              >
                Quiero ser punto de venta
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>
            </div>

            <div className="lg:col-span-7">
              <div className="grid gap-10 md:grid-cols-2">
                <div>
                  <p className="font-body text-[11px] uppercase tracking-ultra text-gold">
                    Beneficios
                  </p>
                  <ul className="mt-5 space-y-3">
                    {m.beneficios.map((b, i) => (
                      <li
                        key={i}
                        className="border-t border-carbon-line pt-3 font-body text-bone/80 leading-relaxed"
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-body text-[11px] uppercase tracking-ultra text-gold">
                    Requisitos
                  </p>
                  <ul className="mt-5 space-y-3">
                    {m.requisitos.map((r, i) => (
                      <li
                        key={i}
                        className="border-t border-carbon-line pt-3 font-body text-bone/80 leading-relaxed"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-6 border-t border-carbon-line pt-5">
      <dt className="font-body text-[11px] uppercase tracking-ultra text-bone/50">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  textarea,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  textarea?: boolean;
  required?: boolean;
}) {
  const base =
    'w-full border-b border-carbon-line px-3 py-3 font-body text-bone placeholder-bone/40 focus:border-gold focus:bg-carbon-raised/30 outline-none transition';

  return (
    <label className="block">
      <span className="font-body text-[11px] uppercase tracking-ultra text-bone/50">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`${base} mt-1 resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} mt-1`}
        />
      )}
    </label>
  );
}
