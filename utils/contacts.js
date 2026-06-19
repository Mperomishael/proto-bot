import fs from 'fs';

const FILE = 'contacts.json';
let contacts = {};
try { contacts = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}

export function saveContacts() {
  fs.writeFileSync(FILE, JSON.stringify(contacts, null, 2));
}

export async function autoSaveContact(sock, jid) {
  if (!jid || contacts[jid]) return;
  contacts[jid] = { jid, saved: new Date().toISOString() };
  saveContacts();
}

export function getContacts()          { return contacts; }
export function findContact(query)     {
  return Object.values(contacts).filter(c => c.jid?.includes(query));
}
