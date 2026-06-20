import fs from 'fs';

export const CONTACTS_FILE = 'contacts.json';
function _load() {
  try { return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')); } catch { return {}; }
}
export let contacts = _load();

export function save() {
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
}
export function saveContacts() { save(); }

export async function autoSaveContact(sock, jid) {
  if (!jid || contacts[jid]) return;
  contacts[jid] = { jid, saved: new Date().toISOString() };
  save();
}

export async function autoSaveGroupContacts(sock, groupJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    let changed = false;
    for (const p of meta.participants) {
      if (!contacts[p.id]) {
        contacts[p.id] = { jid: p.id, group: groupJid, saved: new Date().toISOString() };
        changed = true;
      }
    }
    if (changed) save();
  } catch {}
}

export function getContact(jid)   { return contacts[jid] || null; }
export function listContacts()    { return Object.values(contacts); }
export function getContacts()     { return contacts; }

export function searchContacts(query) {
  const q = query.toLowerCase();
  return Object.values(contacts).filter(c =>
    c.jid?.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)
  );
}
export function findContact(query) { return searchContacts(query); }

export function deleteContact(jid) {
  if (!contacts[jid]) return false;
  delete contacts[jid]; save(); return true;
}

export function exportContacts() {
  return Object.values(contacts)
    .map(c => `${c.name || ''}\t${c.jid || ''}`)
    .join('\n');
}
