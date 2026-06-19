cd ~/proto-bot
cat > utils/helpers.js << 'EOF'
import 'dotenv/config';

export const PREFIX       = process.env.PREFIX       || '.';
export const OWNER_NUMBER = process.env.OWNER_NUMBER || '2348142656848@s.whatsapp.net';
export const BOT_NAME     = process.env.BOT_NAME     || 'EMPIRE BOT-WAN V2';

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
  const top   = '╭━━━〔 ✦ ' + title + ' ✦ 〕━━━╮';
  const bot   = '╰━━━━━━━━━━━━━━━━━━━━╯';
  const lines = body.split('\n').map(l => '┃ ' + l).join('\n');
  return top + '\n' + lines + '\n' + bot;
}

export function buildList() {
  const body = [
    '🤖 *Bot Identity*',
    'Name: ' + BOT_NAME,
    'Prefix: ' + PREFIX,
    'Owner: +' + OWNER_NUMBER.split('@')[0],
    'Mode: 🔒 STRICT PRIVATE',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '📦 *Features*',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '👑 Domain King — bot police',
    '🚫 Antilink shield',
    '📊 Activity tracker',
    '⭐ Reactions tracker',
    '💚 Status auto-react',
    '⚡ Random command reactions',
    '📤 .send — repost as status',
    '🕵️ View-once unlocker (.vv)',
    '👤 Profile lookup (.dp)',
    '📇 Auto-save contacts',
    '',
    'Type ' + PREFIX + 'menu for commands.',
  ].join('\n');
  return frame(BOT_NAME + ' • FEATURE LIST', body);
}

export function buildMenu() {
  const p = PREFIX;
  const body = [
    '📌 *General*',
    '• ' + p + 'ping  • ' + p + 'help',
    '• ' + p + 'list  • ' + p + 'menu',
    '• ' + p + 'dp',
    '',
    '📇 *Contacts*',
    '• ' + p + 'contact list',
    '• ' + p + 'contact search <q>',
    '• ' + p + 'contact save <jid>',
    '• ' + p + 'contact del <jid>',
    '• ' + p + 'contact export',
    '',
    '👥 *Group Info*',
    '• ' + p + 'info  • ' + p + 'tagall',
    '• ' + p + 'link  • ' + p + 'subject',
    '',
    '🛡️ *Moderation*',
    '• ' + p + 'kick  • ' + p + 'promote',
    '• ' + p + 'demote',
    '',
    '🚫 *Antilink*',
    '• ' + p + 'antilink on / off',
    '',
    '📊 *Activity*',
    '• ' + p + 'active [n]',
    '• ' + p + 'inactive',
    '• ' + p + 'resetactivity',
    '',
    '⭐ *Reactions*',
    '• ' + p + 'reactions [limit]',
    '• ' + p + 'reacted [date]',
    '• ' + p + 'reactionstats',
    '',
    '👑 *Domain King*',
    '• ' + p + 'dk on / off / mode',
    '',
    '🕵️ *Media*',
    '• ' + p + 'vv  (reply to view-once)',
    '• ' + p + 'send (reply to repost)',
    '',
    '⚙️ *Admin*',
    '• ' + p + 'reboot  • ' + p + 'update',
    '• ' + p + 'broadcast',
    '• ' + p + 'bank  • ' + p + 'bnk',
  ].join('\n');
  return frame(BOT_NAME + ' • COMMAND MENU', body);
}
EOF
