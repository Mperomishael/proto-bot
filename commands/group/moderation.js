import { getGroupMeta, invalidateGroup } from '../../utils/state.js';
import { getTargets } from '../../utils/helpers.js';

export async function cmdKick(sock, msg, from) {
  try {
    const targets = getTargets(msg);
    if (!targets.length) return sock.sendMessage(from, { text: '↩️ Reply or mention a user.' });
    await sock.groupParticipantsUpdate(from, targets, 'remove');
    invalidateGroup(from);
    await sock.sendMessage(from, { text: '✅ kick ' + targets.length + ' user(s).' });
  } catch (e) {
    console.error('kick error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdPromote(sock, msg, from) {
  try {
    const targets = getTargets(msg);
    if (!targets.length) return sock.sendMessage(from, { text: '↩️ Reply or mention a user.' });
    await sock.groupParticipantsUpdate(from, targets, 'promote');
    invalidateGroup(from);
    await sock.sendMessage(from, { text: '✅ promote ' + targets.length + ' user(s).' });
  } catch (e) {
    console.error('promote error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdDemote(sock, msg, from) {
  try {
    const targets = getTargets(msg);
    if (!targets.length) return sock.sendMessage(from, { text: '↩️ Reply or mention a user.' });
    await sock.groupParticipantsUpdate(from, targets, 'demote');
    invalidateGroup(from);
    await sock.sendMessage(from, { text: '✅ demote ' + targets.length + ' user(s).' });
  } catch (e) {
    console.error('demote error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
