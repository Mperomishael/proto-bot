import 'dotenv/config';

export const PREFIX       = process.env.PREFIX       || '.';
export const OWNER_NUMBER = process.env.OWNER_NUMBER || '';
export const BOT_NAME     = process.env.BOT_NAME     || 'BOT-WAN V2';

export const REACT_EMOJIS = ['⚡','🔥','💎','👑','🚀','✨','🛡️','🎯','💫','🌟'];
export const randomEmoji  = () => REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];

export const isOwner = (jid) => {
  if (!jid) return false;
  const norm = jid.includes('@') ? jid : jid + '@s.whatsapp.net';
  return norm === OWNER_NUMBER;
};

export function getContextInfo(msg) {
  const m = msg.message || {};
  return m.extendedTextMessage?.contextInfo
      || m.imageMessage?.contextInfo
      || m.videoMessage?.contextInfo
      || m.stickerMessage?.contextInfo
      || null;
}

export function getQuotedMessage(msg) {
  const ctx = getContextInfo(msg);
  if (!ctx?.quotedMessage) return null;
  return { quoted: ctx.quotedMessage, participant: ctx.participant, stanzaId: ctx.stanzaId };
}

export function getTargets(msg) {
  const ctx = getContextInfo(msg);
  if (ctx?.mentionedJid?.length) return ctx.mentionedJid;
  if (ctx?.participant) return [ctx.participant];
  return [];
}

export function frame(title, body) {
  const top   = `╭━━━〔 ✦ ${title} ✦ 〕━━━╮`;
  const bot   = `╰━━━━━━━━━━━━━━━━━━━━╯`;
  const lines = body.split('\n').map(l => `┃ ${l}`).join('\n');
  return `${top}\n${lines}\n${bot}`;
}
