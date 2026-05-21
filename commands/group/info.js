import { getGroupMeta, invalidateGroup } from '../../utils/state.js';

export async function cmdInfo(sock, msg, from) {
  try {
    const meta = await getGroupMeta(sock, from);
    const adm = meta.participants.filter(p => p.admin).length;
    await sock.sendMessage(from, {
      text: '📋 *' + meta.subject + '*\n👥 Members: ' + meta.participants.length + '\n👑 Admins: ' + adm + '\n📝 ' + (meta.desc || '(none)')
    });
  } catch (e) {
    console.error('info error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}

export async function cmdTagAll(sock, msg, from) {
  try {
    const meta = await getGroupMeta(sock, from);
    const mentions = meta.participants.map(p => p.id);
    await sock.sendMessage(from, { text: '📢 ' + mentions.map(id => '@' + id.split('@')[0]).join(' '), mentions });
  } catch (e) {
    console.error('tagall error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
