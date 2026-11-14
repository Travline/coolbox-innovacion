/** Contact data is public configuration, never model-generated or read from Turso. */
export const CONTACT_SOURCE = 'https://www.coolbox.pe/canales-de-atencion';
export type ContactGuidance = { sourceUrl: typeof CONTACT_SOURCE; checkedAt: string | null; whatsapp: string | null; email: string | null };

function todayInLima(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Dates are an explicit manual confirmation for this presentation day. */
export function contactGuidance(env: NodeJS.ProcessEnv = process.env, now = new Date()): ContactGuidance {
  const fallback: ContactGuidance = { sourceUrl: CONTACT_SOURCE, checkedAt: null, whatsapp: null, email: null };
  const today = todayInLima(now);
  if (env.CONTACTS_PRESENTATION_DATE !== today || env.CONTACTS_CHECKED_AT !== today) return fallback;
  const phone = env.CONTACTS_WHATSAPP?.trim() ?? '';
  const email = env.CONTACTS_EMAIL?.trim() ?? '';
  const whatsapp = /^\d{8,15}$/.test(phone) ? phone : null;
  const address = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) && email.length <= 254 ? email : null;
  return whatsapp || address ? { sourceUrl: CONTACT_SOURCE, checkedAt: today, whatsapp, email: address } : fallback;
}
