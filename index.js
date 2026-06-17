// ============================================================
//  EMPIRE BOT-WAN (PROTOTYPE) — index.js (RECTIFIED 2026)
// ============================================================
import pkg from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = pkg;
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

// ====== COMMAND IMPORTS ======
import {
  cmdPing, cmdHelp, cmdList, cmdMenu, cmdProfile,
  cmdViewOnce, cmdSend,
  cmdInfo, cmdTagAll,
  cmdKick, cmdPromote, cmdDemote,
  cmdSubject, cmdLink,
  handleAntilink, cmdAntilink,
  cmdActive, cmdInactive, cmdResetActivity, trackActivity,
  cmdDk,
  trackReactions, handleReactionUpdate, cmdReactions, cmdReacted, cmdNotReacted, cmdClearReactions, cmdReactionStats,
  cmdContactList, cmdContactSearch, cmdContactSave, cmdContactDelete,
  cmdContactExport, cmdContactAutoGroup, cmdContactHelp,
  cmdUpdate, cmdReboot 
} from './commands/index.js';

import { PREFIX, OWNER_NUMBER, BOT_NAME, randomEmoji, isOwner } from './utils/helpers.js';
import { reactions, invalidateGroup, REACTIONS_FILE, save } from './utils/state.js';
import { autoSaveContact } from './utils/contacts.js';
import { sendBootSuccess } from './lib/welcome.js';
import { handlePublicPairRequest } from './lib/publicPair.js';
import { cmdPair } from './commands/pair.js';

// Global flag to prevent pairing loops
let pairingCodeRequested = false;

async function startBot() {
  console.log('⏳ Initializing ' + BOT_NAME + '...');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    shouldIgnoreJid: () => false,
    // 🛡️ RECTIFIED: Ubuntu/Chrome is the most stable fingerprint for 2026 pairing
    browser: Browsers.ubuntu('Chrome'), 
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  // ====== CONNECTION & PAIRING HANDLER ======
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;

    // Handle Pairing Code Generation
    if (qr && !state.creds.registered && !pairingCodeRequested) {
      pairingCodeRequested = true;
      console.log('🔌 Socket stable. Requesting pairing code for: ' + OWNER_NUMBER);
      
      try {
        // Essential delay to prevent Error 405/428
        await new Promise(r => setTimeout(r, 5000));
        
        const code = await sock.requestPairingCode(OWNER_NUMBER.replace(/\D/g, ''));
        const formatted = code.match(/.{1,4}/g)?.join('-') || code;
        
        console.log('\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮');
        console.log('┃   🔗 YOUR PAIRING CODE      ┃');
        console.log('┃   👉  ' + formatted.padEnd(20) + '┃');
        console.log('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n');
        console.log('📱 Link this code in WhatsApp -> Linked Devices\n');
      } catch (e) {
        console.error('❌ Pairing Error:', e.message);
        pairingCodeRequested = false;
      }
    }

    if (connection === 'connecting') console.log('🔌 Connecting to WhatsApp...');

    if (connection === 'open') {
      console.log('✅ ' + BOT_NAME + ' is ONLINE');
      pairingCodeRequested = false;
      sendBootSuccess(sock).catch(e => console.error('boot dm:', e.message));
    }

    if (connection === 'close') {
      pairingCodeRequested = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'unknown';
      
      console.log('❌ Connection Closed. Code:', code, 'Reason:', reason);

      if (code === DisconnectReason.loggedOut) {
        console.log('🚪 Logged out. Delete auth_info/ and restart.');
      } else {
        // Retry for 515 (Restart), 428 (Precondition), or 405 (Method)
        const delay = code === 405 ? 10000 : 3000;
        console.log(`🔄 Reconnecting in ${delay/1000}s...`);
        setTimeout(startBot, delay);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ====== MESSAGE HANDLER ======
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      handleMessage(sock, msg).catch(e => console.error('❌ Handler Error:', e.message));
    }
  });

  // Group metadata cache invalidation
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

  const text = msg.message.conversation || msg.message.extendedTextMessage?.text || 
               msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';

  // Activity & Contacts
  if (isGroup && !fromMe) trackActivity(from, sender);
  if (!fromMe) autoSaveContact(sock, sender).catch(() => {});

  // Antilink
  if (isGroup && !fromMe && !ownerIsSender) {
    const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
    const blocked = await handleAntilink(sock, msg, sender, from, text, botJid);
    if (blocked) return;
  }

  // Public Pairing
  if (!fromMe && text && !text.startsWith(PREFIX)) {
    const handled = await handlePublicPairRequest(sock, msg, from, sender, text);
    if (handled) return;
  }

  // Command Parser
  if (!text.startsWith(PREFIX)) return;
  if (!ownerIsSender) return console.log('🔒 Blocked non-owner: ' + sender);

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  console.log('⚡ COMMAND: ' + command);
  sock.sendMessage(from, { react: { text: randomEmoji(), key: msg.key } }).catch(() => {});

  try {
    await runCommand(sock, msg, from, command, args, isGroup);
  } catch (e) {
    sock.sendMessage(from, { text: '❌ Error: ' + e.message });
  }
}

async function runCommand(sock, msg, from, command, args, isGroup) {
  switch (command) {
    case 'ping':    return cmdPing(sock, msg, from);
    case 'help':    return cmdHelp(sock, msg, from);
    case 'menu':    return cmdMenu(sock, msg, from);
    case 'dp':      return cmdProfile(sock, msg, from, args);
    case 'update':  return cmdUpdate(sock, msg, from);
    case 'reboot':  return cmdReboot(sock, msg, from);
    case 'pair':    return cmdPair(sock, msg, from, args);
    // Add other cases as needed...
  }
}

process.on('uncaughtException', (e) => console.error('🔥 Critical:', e));
process.on('unhandledRejection', (e) => console.error('🔥 Promise Rejected:', e));

startBot();
