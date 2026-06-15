// ====== HELPERS ======
export const PREFIX = '.';
export const OWNER_NUMBER = '2348142656848@s.whatsapp.net';
export const BOT_NAME = 'EMPIRE BOT-WAN (PROTOTYPE)';

export const REACT_EMOJIS = ['⚡','🔥','💎','👑','🚀','✨','🛡️','🎯','💫','🌟','🦅','🐉','🗡️','💠','🪐','🏆'];
export const randomEmoji = () => REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];

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
      || m.documentMessage?.contextInfo
      || m.audioMessage?.contextInfo
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
  const top = '╭━━━〔 ✦ ' + title + ' ✦ 〕━━━╮';
  const bot = '╰━━━━━━━━━━━━━━━━━━━━╯';
  const lines = body.split('\n').map(l => '┃ ' + l).join('\n');
  return top + '\n' + lines + '\n' + bot;
}

export function buildList() {
  const body =
'🤖 *Bot Identity*\n' +
'Name: ' + BOT_NAME + '\n' +
'Prefix: ' + PREFIX + '\n' +
'Owner: +' + OWNER_NUMBER.split('@')[0] + '\n' +
'Mode: 🔒 STRICT PRIVATE\n\n' +
'━━━━━━━━━━━━━━━━━━\n' +
'📦 *Features*\n' +
'━━━━━━━━━━━━━━━━━━\n\n' +
'👑 Domain King — bot police\n' +
'🚫 Antilink shield\n' +
'📊 Activity tracker\n' +
'⭐ Message reactions tracker\n' +
'💚 Status auto-react\n' +
'⚡ Random command reactions\n' +
'📤 .send — repost as status\n' +
'   + auto-DM on status replies\n' +
'🕵️ View-once unlocker (.vv)\n' +
'👤 Profile lookup (.dp) → DM\n' +
'📇 Auto-save contacts (smart)\n' +
'⚙️ Reply-aware commands\n' +
'⚡ Cached for fast responses\n\n' +
'━━━━━━━━━━━━━━━━━━\n' +
'Type ' + PREFIX + 'menu for commands.';
  return frame(BOT_NAME + ' • FEATURE LIST', body);
}

export function buildMenu() {
  const p = PREFIX;
  const body =
'📌 *General*\n' +
'• ' + p + 'ping  • ' + p + 'help\n' +
'• ' + p + 'list  • ' + p + 'menu\n' +
'• ' + p + 'dp\n\n' +
'📇 *Contacts*\n' +
'• ' + p + 'contact list [n]\n' +
'• ' + p + 'contact search <q>\n' +
'• ' + p + 'contact save <name>\n' +
'• ' + p + 'contact del <name>\n' +
'• ' + p + 'contact export\n' +
'• ' + p + 'contact autog [prefix]\n\n' +
'👥 *Group Info*\n' +
'• ' + p + 'info  • ' + p + 'tagall\n' +
'• ' + p + 'link  • ' + p + 'subject <text>\n\n' +
'🛡️ *Moderation*\n' +
'• ' + p + 'kick  • ' + p + 'promote\n' +
'• ' + p + 'demote\n\n' +
'🚫 *Antilink*\n' +
'• ' + p + 'antilink on / off\n\n' +
'📊 *Activity*\n' +
'• ' + p + 'active [n]\n' +
'• ' + p + 'inactive <days>\n' +
'• ' + p + 'resetactivity\n\n' +
'⭐ *Reactions*\n' +
'• ' + p + 'reactions [limit]\n' +
'• ' + p + 'reacted [date]\n' +
'• ' + p + 'notreacted [date]\n' +
'• ' + p + 'reactionstats [date]\n' +
'• ' + p + 'clearreactions\n\n' +
'👑 *Domain King*\n' +
'• ' + p + 'dk on / off / mode / arrested / pardon\n\n' +
'🕵️ *Media*\n' +
'• ' + p + 'vv (reply to view-once)\n' +
'• ' + p + 'send (reply to repost as status)';
  return frame(BOT_NAME + ' • COMMAND MENU', body);
}
