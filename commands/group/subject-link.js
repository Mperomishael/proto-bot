import { PREFIX } from '../../utils/helpers.js';
import { getGroupMeta, invalidateGroup } from '../../utils/state.js';

export async function cmdSubject(sock, msg, from, args) {
  try {
    if (!args.length) return sock.sendMessage(from, { text: 'Usage: ' + PREFIX + 'subject <new name>' });
    await sock.groupUpdateSubject(from, args.join(' '));
    invalidateGroup(from);
    await sock.sendMessage(from, { text: '✅ Group name updated.' });
  } catch (e) {
    console.error('subject error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdLink(sock, msg, from) {
  try {
    const code = await sock.groupInviteCode(from);
    await sock.sendMessage(from, { text: '🔗 https://chat.whatsapp.com/' + code });
  } catch (e) {
    console.error('link error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
