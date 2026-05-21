import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { PREFIX, getQuotedMessage } from '../../utils/helpers.js';
import { statusLog, STATUS_LOG_FILE, save } from '../../utils/state.js';

export async function cmdSend(sock, msg, from) {
  const q = getQuotedMessage(msg);
  if (!q) return sock.sendMessage(from, { text: '↩️ Reply to a message with ' + PREFIX + 'send' });
  
  try {
    const inner = q.quoted;
    const type = Object.keys(inner).find(k => k.endsWith('Message')) || (inner.conversation ? 'conversation' : null);
    let result, log;
    
    if (type === 'conversation' || type === 'extendedTextMessage') {
      const t = inner.conversation || inner.extendedTextMessage?.text || '';
      result = await sock.sendMessage('status@broadcast', { text: t }, { backgroundColor: '#000000', font: 3 });
      log = { type: 'text', text: t };
    } else if (type === 'imageMessage' || type === 'videoMessage') {
      const synth = { key: { remoteJid: from, fromMe: false, id: q.stanzaId, participant: q.participant }, message: inner };
      const buf = await downloadMediaMessage(synth, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      const cap = inner[type].caption || '';
      
      if (type === 'imageMessage') {
        result = await sock.sendMessage('status@broadcast', { image: buf, caption: cap });
        log = { type: 'image', data: buf.toString('base64'), caption: cap };
      } else {
        result = await sock.sendMessage('status@broadcast', { video: buf, caption: cap });
        log = { type: 'video', data: buf.toString('base64'), caption: cap };
      }
    } else {
      return sock.sendMessage(from, { text: '⚠️ Only text/image/video supported.' });
    }

    if (result?.key?.id && log) {
      statusLog[result.key.id] = log;
      const k = Object.keys(statusLog);
      if (k.length > 50) delete statusLog[k[0]];
      save(STATUS_LOG_FILE, statusLog);
    }
    await sock.sendMessage(from, { text: '✅ Posted. Replies will auto-DM.' });
  } catch (e) {
    console.error('send error:', e.message);
    await sock.sendMessage(from, { text: '❌ ' + e.message });
  }
}
