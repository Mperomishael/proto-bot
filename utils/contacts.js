import fs from 'fs';

export const CONTACTS_FILE = './contacts.json';

const load = (f, fallback) => {
  try {
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : fallback;
  } catch {
    return fallback;
  }
};

export let contacts = load(CONTACTS_FILE, {});

export const save = (d) => {
  try {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(d, null, 2));
  } catch (e) {
    console.error('contacts save fail:', e.message);
  }
};

export async function autoSaveContact(sock, jid, name = null) {
  // Extract number from jid
  const num = jid.split('@')[0];
  if (!num || num.length < 5) return false;

  // Don't save if already exists
  if (contacts[num]) return false;

  try {
    // Get name from WhatsApp if not provided
    let displayName = name;
    if (!displayName) {
      const onWA = await sock.onWhatsApp(jid).catch(() => null);
      displayName = onWA?.[0]?.notify || onWA?.[0]?.name || null;
    }

    contacts[num] = {
      number: num,
      jid: jid,
      name: displayName || '(Unknown)',
      source: 'auto-save',
      savedAt: new Date().toISOString()
    };

    save(contacts);
    return true;
  } catch (e) {
    console.error('auto-save contact error:', e.message);
    return false;
  }
}

export async function autoSaveGroupContacts(sock, groupJid, prefix = '') {
  try {
    const meta = await sock.groupMetadata(groupJid);
    let saved = 0;

    for (const participant of meta.participants) {
      const num = participant.id.split('@')[0];
      if (contacts[num]) continue;

      const name = prefix ? prefix + '_' + (participant.name || num) : (participant.name || num);
      contacts[num] = {
        number: num,
        jid: participant.id,
        name: name,
        source: 'group-auto-save',
        groupName: meta.subject,
        savedAt: new Date().toISOString()
      };
      saved++;
    }

    if (saved > 0) save(contacts);
    return saved;
  } catch (e) {
    console.error('group auto-save error:', e.message);
    return 0;
  }
}

export function getContact(identifier) {
  // Search by number or name
  if (contacts[identifier]) return contacts[identifier];
  return Object.values(contacts).find(c => c.name.toLowerCase() === identifier.toLowerCase());
}

export function searchContacts(query) {
  const q = query.toLowerCase();
  return Object.values(contacts).filter(c =>
    c.number.includes(q) || c.name.toLowerCase().includes(q)
  );
}

export function deleteContact(identifier) {
  const contact = getContact(identifier);
  if (!contact) return false;
  delete contacts[contact.number];
  save(contacts);
  return true;
}

export function listContacts(limit = 20) {
  const list = Object.values(contacts).slice(0, limit);
  return list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

export function exportContacts() {
  return JSON.stringify(contacts, null, 2);
}
