// ============================================================
//  BOTWAN PROTOTYPE (EMPIRE DIGITALS) — index.js (FINAL 2026)
// ============================================================
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';

import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

// ====== COMMAND IMPORTS ======
import {
  cmdPing, cmdHelp, cmdList, cmdMenu, cmdProfile,
  cmdViewOnce, cmdSend, cmdSteal,
  cmdInfo, cmdTagAll, cmdKick, cmdPromote, cmdDemote,
  cmdSubject, cmdLink, cmdAntilink, handleAntilink,
  cmdActive, cmdInactive, cmdResetActivity, trackActivity,
  cmdDk, cmdReactions, cmdReactionStats,
  cmdContactList, cmdContactSearch, cmdContactSave,
  cmdUpdate, cmdReboot, cmdPair,
  cmdBankSettings, cmdShowBank, cmdBroadcast
} from './commands/index.js';

import { PREFIX, OWNER_NUMBER, BOT_NAME, randomEmoji, isOwner } from './utils/helpers.js';
import { reactions, invalidateGroup, REACTIONS_FILE, save, activity } from './utils/state.js';
import { autoSaveContact } from './utils/contacts.js';
import { sendBootSuccess } from './lib/welcome.js';
import { handlePublicPairRequest } from './lib/publicPair.js';
import { getAIResponse } from './lib/ai_logic.js';

let pairingCodeRequested = false;

async function startBot() {
  console.log('⏳ Starting ' + BOT_NAME + '...');
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    browser: Browsers.macOS('Safari'), 
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr && !state.creds.registered && !pairingCodeRequested) {
      pairingCodeRequested = true;
      console.log('🔌 Socket stable. Waiting 8s for handshake...');
      await new Promise(r => setTimeout(r, 8000));
      try {
        const phoneDigits = OWNER_NUMBER.replace(/\D/g, '');
        const code = await sock.requestPairingCode(phoneDigits);
        console.log('----------------------------');
        console.log('🔗 PAIRING CODE: ' + code);
        console.log('----------------------------');
      } catch (e) {
        console.error('❌ Pairing Error:', e.message);
        pairingCodeRequested = false;
      }
    }
    if (connection === 'open') {
      console.log('✅ ' + BOT_NAME + ' is ONLINE');
      pairingCodeRequested = false;
      sendBootSuccess(sock).catch(e => console.error('boot dm:', e.message));
    }
    if (connection === 'close') {
      pairingCodeRequested = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('❌ Disconnected. Code: ' + code);
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      handleMessage(sock, msg).catch(e => console.error('❌ handler crash:', e.message));
    }
  });

  sock.ev.on('groups.update', (us) => us.forEach(u => u.id && invalidateGroup(u.id)));
  sock.ev.on('group-participants.update', (e) => invalidateGroup(e.id));
}

async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  if (!from || from === 'status@broadcast') return;
  const isGroup = from.endsWith('@g.us');
  const fromMe = msg.key.fromMe;
  const sender = fromMe ? OWNER_NUMBER : (msg.key.participant || from);
  const ownerIsSender = isOwner(sender);
  const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
  const text = msg.message.conversation || msg.message.extendedTextMessage?.text || 
               msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';

  if (isGroup && !fromMe) trackActivity(from, sender);
  if (!fromMe) autoSaveContact(sock, sender).catch(() => {});

  if (text === '#' && ownerIsSender && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    return cmdSteal(sock, msg, from);
  }

  const chatEnabled = activity[from]?.chatMode || false;
  const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === botJid;
  const isMentioned = text.includes('@' + botJid.split('@')[0]);

  if (chatEnabled && (isReplyToBot || isMentioned || !isGroup)) {
    if (!text.startsWith(PREFIX)) {
      const aiResponse = await getAIResponse(text);
      return sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
    }
  }

  if (!fromMe && text && !text.startsWith(PREFIX)) {
    const handled = await handlePublicPairRequest(sock, msg, from, sender, text);
    if (handled) return;
  }

  if (!text.startsWith(PREFIX)) return;
  if (!ownerIsSender) return;

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  sock.sendMessage(from, { react: { text: randomEmoji(), key: msg.key } }).catch(() => {});

  try {
    await runCommand(sock, msg, from, command, args, isGroup);
  } catch (e) {
    sock.sendMessage(from, { text: '❌ Error: ' + e.message });
  }
}

async function runCommand(sock, msg, from, command, args, isGroup) {
  switch (command) {
    case 'ping': return cmdPing(sock, msg, from);
    case 'help': return cmdHelp(sock, msg, from);
    case 'menu': return cmdMenu(sock, msg, from);
    case 'dp': return cmdProfile(sock, msg, from, args);
    case 'chat': {
      const mode = args[0] === 'on';
      if (!activity[from]) activity[from] = {};
      activity[from].chatMode = mode;
      return sock.sendMessage(from, { text: '🤖 *Botwan AI Chat:* ' + (mode ? 'On' : 'Off') });
    }
    case 'bank': return cmdShowBank(sock, msg, from);
    case 'bnk': return cmdBankSettings(sock, msg, from, args);
    case 'update': return cmdUpdate(sock, msg, from);
    case 'reboot': return cmdReboot(sock, msg, from);
    case 'broadcast': return cmdBroadcast(sock, msg, from, args);
    case 'pair': return cmdPair(sock, msg, from, args);
  }
}

process.on('uncaughtException', (e) => console.error('🔥 Critical:', e));
process.on('unhandledRejection', (e) => console.error('🔥 Rejected:', e));
startBot();
