import { useEffect, useState } from 'react';
import { CONTACT_SOURCE } from './chat';
import type { ContactGuidance as Guidance } from './chat';

/** Contacts expire at the end of the manually confirmed presentation day in Peru. */
export function ContactGuidance({ guidance }: { guidance: Guidance | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Peru has UTC-05:00 year-round; refresh exactly at the next local midnight.
    const shifted = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const nextMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1, 5);
    const timer = setTimeout(() => setNow(new Date()), Math.max(1, nextMidnight - now.getTime()));
    return () => clearTimeout(timer);
  }, [now]);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  const current = guidance?.sourceUrl === CONTACT_SOURCE && guidance.checkedAt === today;
  const phone = current && guidance?.whatsapp && /^\d{8,15}$/.test(guidance.whatsapp) ? guidance.whatsapp : null;
  const email = current && guidance?.email && /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(guidance.email) ? guidance.email : null;
  return <section className="contact-guidance" aria-label="Canales oficiales de atención">
    {phone || email ? <><p>Canales revisados: {guidance?.checkedAt}.</p>{phone && <p><a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">WhatsApp: {phone}</a></p>}{email && <p><a href={`mailto:${email}`}>Correo: {email}</a></p>}</> : <p>No puedo confirmar los datos de contacto para esta presentación.</p>}
    <p><a href={CONTACT_SOURCE} target="_blank" rel="noopener noreferrer">Consultar la página oficial de canales</a></p>
  </section>;
}
