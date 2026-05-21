import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { OWNER_NUMBER, getQuotedMessage } from '../../utils/helpers.js';

export async function cmdViewOnce(sock, msg, from) {
  const q = getQuotedMessage(msg);
  if (!q) return sock.sendMessage(from, { text: '↩️ Reply to a view-once first.' });
  
  try {
    let inner = q.quoted;
    if (inner.viewOnceMessage)            inner = inner.viewOnceMessage.message;
    if (inner.viewOnceMessageV2)          inner = inner.viewOnceMessageV2.message;
    if (inner.viewOnceMessageV2Extension) inner = inner.viewOnceMessageV2Extension.message;
    if (inner.ephemeralMessage)           inner = inner.ephemeralMessage.message;
    
    const type = Object.keys(inner).find(k => k.endsWith('Message'));
    if (!type) return sock.sendMessage(from, { text: '⚠️ No media found.' });
    
    const media = inner[type];
    const synth = { key: { remoteJid: from, fromMe: false, id: q.stanzaId, participant: q.participant }, message: inner };
    const buf = await downloadMediaMessage(synth, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
    const cap = '🕵️ View-Once Unlocked\n' + (media?.caption || '');
    
    if      (type === 'imageMessage') await sock.sendMessage(OWNER_NUMBER, { image: buf, caption: cap });
    else if (type === 'videoMessage') await sock.sendMessage(OWNER_NUMBER, { video: buf, caption: cap });
    else if (type === 'audioMessage') await sock.sendMessage(OWNER_NUMBER, { audio: buf, mimetype: media.mimetype || 'audio/mp4', ptt: !!media.ptt });
    
    if (from !== OWNER_NUMBER) await sock.sendMessage(from, { text: '✅ Sent to your DM.' });
  } catch (e) {
    console.error('viewOnce error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
