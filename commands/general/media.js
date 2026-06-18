import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { OWNER_NUMBER } from '../../utils/helpers.js';

export async function cmdSteal(sock, msg, from) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return;

  // Identify media type
  const type = Object.keys(quoted)[0];
  const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(type);

  if (!isMedia) return;

  try {
    const stream = await downloadContentFromMessage(quoted[type], type.replace('Message', ''));
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    const mediaContent = {};
    mediaContent[type.replace('Message', '')] = buffer;
    mediaContent.caption = quoted[type]?.caption || '✅ *Media Saved*';

    // Send to Owner's DM
    await sock.sendMessage(OWNER_NUMBER, mediaContent);
    await sock.sendMessage(from, { react: { text: '📥', key: msg.key } });
  } catch (e) {
    console.error('Steal error:', e);
    await sock.sendMessage(from, { text: '❌ Failed to save media.' });
  }
}
