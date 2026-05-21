import { OWNER_NUMBER, getTargets } from '../utils/helpers.js';
import {
  autoSaveContact,
  autoSaveGroupContacts,
  getContact,
  searchContacts,
  deleteContact,
  listContacts,
  exportContacts,
  contacts,
  CONTACTS_FILE,
  save
} from '../utils/contacts.js';

export async function cmdContactList(sock, msg, from, args) {
  try {
    const limit = parseInt(args[0]) || 20;
    const list = listContacts(limit);

    if (!list.length) {
      return sock.sendMessage(from, { text: '📇 No contacts saved yet.' });
    }

    const txt = list
      .map((c, i) => (i + 1) + '. ' + c.name + ' (+' + c.number + ')')
      .join('\n');

    await sock.sendMessage(from, { text: '📇 *Saved Contacts (' + list.length + ')*\n\n' + txt });
  } catch (e) {
    console.error('contact list error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdContactSearch(sock, msg, from, args) {
  try {
    if (!args.length) {
      return sock.sendMessage(from, { text: '⚠️ Usage: .contact search <name/number>' });
    }

    const query = args.join(' ');
    const results = searchContacts(query);

    if (!results.length) {
      return sock.sendMessage(from, { text: '🔍 No contacts found.' });
    }

    const txt = results
      .map(c => '📱 ' + c.name + '\n   +' + c.number + '\n   ' + c.source)
      .join('\n\n');

    await sock.sendMessage(from, { text: '🔍 *Search Results*\n\n' + txt });
  } catch (e) {
    console.error('contact search error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdContactSave(sock, msg, from, args) {
  try {
    const targets = getTargets(msg);
    if (!targets.length) {
      return sock.sendMessage(from, { text: '↩️ Reply or mention a user to save.' });
    }

    const target = targets[0];
    const customName = args.length ? args.join(' ') : null;
    const saved = await autoSaveContact(sock, target, customName);

    if (!saved) {
      return sock.sendMessage(from, { text: '⚠️ Contact already exists.' });
    }

    const num = target.split('@')[0];
    const contact = contacts[num];
    await sock.sendMessage(from, { text: '✅ Saved: ' + contact.name + ' (+' + num + ')' });
  } catch (e) {
    console.error('contact save error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdContactDelete(sock, msg, from, args) {
  try {
    if (!args.length) {
      return sock.sendMessage(from, { text: '⚠️ Usage: .contact del <name/number>' });
    }

    const identifier = args.join(' ');
    const deleted = deleteContact(identifier);

    if (!deleted) {
      return sock.sendMessage(from, { text: '❌ Contact not found.' });
    }

    await sock.sendMessage(from, { text: '🗑️ Deleted.' });
  } catch (e) {
    console.error('contact delete error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdContactExport(sock, msg, from) {
  try {
    const data = exportContacts();
    const buffer = Buffer.from(data);

    await sock.sendMessage(OWNER_NUMBER, {
      document: buffer,
      mimetype: 'application/json',
      fileName: 'contacts.json'
    });

    await sock.sendMessage(from, { text: '📥 Contacts exported to your DM.' });
  } catch (e) {
    console.error('contact export error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdContactAutoGroup(sock, msg, from, args) {
  try {
    const prefix = args[0] || 'GROUP';
    const saved = await autoSaveGroupContacts(sock, from, prefix);

    await sock.sendMessage(from, { text: '✅ Auto-saved ' + saved + ' contacts with prefix: ' + prefix });
  } catch (e) {
    console.error('contact auto-group error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdContactHelp(sock, msg, from) {
  try {
    const txt =
'📇 *Contact Commands*\n\n' +
'.contact list [n] — List n recent\n' +
'.contact search <q> — Find contact\n' +
'.contact save <name> — Save from reply\n' +
'.contact del <name> — Delete\n' +
'.contact autog [prefix] — Auto-save group\n' +
'.contact export — Download JSON';

    await sock.sendMessage(from, { text: txt });
  } catch (e) {
    console.error('contact help error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
