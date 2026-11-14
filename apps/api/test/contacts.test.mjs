import test from 'node:test';
import assert from 'node:assert/strict';
import { contactGuidance, CONTACT_SOURCE } from '../dist/contacts.js';
const now = new Date('2026-11-13T15:00:00Z');
const config = { CONTACTS_PRESENTATION_DATE:'2026-11-13', CONTACTS_CHECKED_AT:'2026-11-13', CONTACTS_WHATSAPP:'51966032014', CONTACTS_EMAIL:'contacto@example.test' };
test('contactos se publican únicamente con revisión para el día de presentación', () => {
  assert.deepEqual(contactGuidance(config, now), {sourceUrl:CONTACT_SOURCE, checkedAt:'2026-11-13', whatsapp:'51966032014', email:'contacto@example.test'});
  for (const env of [{}, {...config,CONTACTS_PRESENTATION_DATE:''}, {...config,CONTACTS_CHECKED_AT:'2026-11-12'}, {...config,CONTACTS_PRESENTATION_DATE:'2026-11-14'}]) {
    const result=contactGuidance(env,now); assert.equal(result.whatsapp,null); assert.equal(result.email,null); assert.equal(result.checkedAt,null); assert.equal(result.sourceUrl,CONTACT_SOURCE);
  }
});
test('rechaza contactos no seguros aunque estén marcados como revisados', () => {
  const result=contactGuidance({...config,CONTACTS_WHATSAPP:'123?evil',CONTACTS_EMAIL:'evil@example.test?bcc=x'},now);
  assert.equal(result.whatsapp,null);assert.equal(result.email,null);assert.equal(result.checkedAt,null);
});
test('la fecha corresponde a Perú y la revisión expira en el día siguiente', () => {
  assert.equal(contactGuidance(config,new Date('2026-11-14T02:00:00Z')).checkedAt,'2026-11-13');
  assert.equal(contactGuidance(config,new Date('2026-11-14T05:01:00Z')).checkedAt,null);
});
