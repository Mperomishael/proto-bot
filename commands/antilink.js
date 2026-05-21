import { antilinkGroups, ANTILINK_FILE, save, getGroupMeta } from '../utils/state.js';

export async function handleAntilink(sock, msg, sender, from, text, botJid) {
  if (antilinkGroups[from]) {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-z0-9-]+\.(com|net|org|io|co|me|xyz|app|dev|gg|tv|ng|us|uk|ca|in|info|biz|live|online|store|shop|tech|site)(\/[^\s]*)?\b)|(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b)|(t\.me\/[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)|(wa\.me\/[^\s]+)|(youtu\.be\/[^\s]+)|(bit\.ly\/[^\s]+)|(tinyurl\.com\/[^\s]+)|(t\.co\/[^\s]+)/i;
    if (linkRegex.test(text)) {
      try {
        const meta = await sock.groupMetadata(from);
        const senderAdmin = meta.participants.find(p => p.id === sender)?.admin;
        if (!senderAdmin) {
          sock.sendMessage(from, { delete: msg.key }).catch(() => {});
          sock.sendMessage(from, { text: '🚫 @' + sender.split('@')[0] + ' links not allowed.', mentions: [sender] }).catch(() => {});
          console.log('🚫 Link deleted from ' + sender.split('@')[0]);
          return true;
        }
      } catch (e) { 
        console.error('antilink error:', e.message); 
      }
    }
  }
  return false;
}

export async function cmdAntilink(sock, msg, from, args) {
  try {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'on') {
      antilinkGroups[from] = true;
      save(ANTILINK_FILE, antilinkGroups);
      return sock.sendMessage(from, { text: '✅ Antilink ON.' });
    }
    if (sub === 'off') {
      delete antilinkGroups[from];
      save(ANTILINK_FILE, antilinkGroups);
      return sock.sendMessage(from, { text: '❌ Antilink OFF.' });
    }
    return sock.sendMessage(from, { text: 'Antilink: ' + (antilinkGroups[from] ? 'ON' : 'OFF') });
  } catch (e) {
    console.error('antilink cmd error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
