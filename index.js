// ============================================================
//  EMPIRE BOT-WAN (PROTOTYPE) — index.js (FINAL IMPORT FIX)
// ============================================================
import pkg from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

// This is the only way to handle all Baileys versions in 2026
const makeWASocket = pkg.default || pkg;
const authUtils = pkg.default || pkg;
const { useMultiFileAuthState, DisconnectReason, Browsers } = authUtils;

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

// ====== UTILITY IMPORTS ======
import {
  PREFIX, OWNER_NUMBER, BOT_NAME, randomEmoji, isOwner
} from './utils/helpers.js';

import {
  reactions, invalidateGroup, REACTIONS_FILE, save
} from './utils/state.js';

import { autoSaveContact } from './utils/contacts.js';

// ====== PAIRING / WELCOME / PUBLIC PAIR ======
import { sendBootSuccess } from './lib/welcome.js';
import { handlePublicPairRequest } from './lib/publicPair.js';
import { cmdPair } from './commands/pair.js';

let pairingCodeRequested = false;

// ============================================================
//  MAIN START
// ============================================================
async function startBot() {
  console.log('⏳ Starting ' + BOT_NAME + ' (Safe-Fingerprint Mode)...');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    shouldIgnoreJid: () => false,
    // 🛡️ RECTIFIED 2026: macOS Safari is the safest fingerprint to bypass 405/428 errors
    browser: Browsers.macOS('Safari'), 
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  // ====== CONNECTION & PAIRING HANDLER ======
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;

    // 🔗 PAIRING CODE LOGIC
    if (qr && !state.creds.registered && !pairingCodeRequested) {
      pairingCodeRequested = true;
      console.log('🔌 Socket stable. Waiting 8s to bypass WhatsApp security checks...');
      
      try {
        // ⏳ MANDATORY DELAY: Prevents "Method Not Allowed" (405)
        await new Promise(r => setTimeout(r, 8000));
        
        const phoneDigits = OWNER_NUMBER.replace(/\D/g, '');
        const code = await sock.requestPairingCode(phoneDigits);
        const formatted = code.match(/.{1,4}/g)?.join('-') || code;
        
        const NL = String.fromCharCode(10);
        console.log(NL + '╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮');
        console.log('┃   🔗 YOUR PAIRING CODE      ┃');
        console.log('┃   👉  ' + formatted.padEnd(20) + '┃');
        console.log('╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯' + NL);
        console.log('📱 Enter this on: Linked Devices -> Link with phone number' + NL);
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
      
      console.log('❌ Disconnected. Code:', code, 'Reason:', reason);

      if (code === 515 || code === 428 || code === 405) {
        // 515: Restart Required (Normal after pairing)
        // 428/405: Handshake failure (Needs longer cooldown)
        const cooldown = (code === 405) ? 10000 : 3000;
        console.log(`🔄 Reconnecting in ${cooldown/1000}s...`);
        setTimeout(startBot, cooldown);
      } else if (code === DisconnectReason.loggedOut) {
        console.log('🚪 Logged out. Delete auth_info/ and restart.');
      } else {
        setTimeout(startBot, 5000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ====== MESSAGE DISPATCHER ======
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      handleMessage(sock, msg).catch(e => console.error('❌ handler crash:', e.message));
    }
  });

  // Group metadata cache management
  sock.ev.on('groups.update', (us) => us.forEach(u => u.id && invalidateGroup(u.id)));
  sock.ev.on('group-participants.update', (e) => invalidateGroup(e.id));

  console.log('✅ Event listeners registered.');
}

// ============================================================
//  MESSAGE HANDLER
// ============================================================
async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  if (!from || from === 'status@broadcast') return;

  const isGroup  = from.endsWith('@g.us');
  const fromMe   = msg.key.fromMe === true;

  const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';

  let sender;
  if (fromMe) sender = OWNER_NUMBER;
  else        sender = msg.key.participant || from;

  const ownerIsSender = isOwner(sender);

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    '';

  // Log activity
  if (isGroup && !fromMe) trackActivity(from, sender);
  if (!fromMe) autoSaveContact(sock, sender).catch(() => {});

  // Antilink
  if (isGroup && !fromMe && !ownerIsSender) {
    const blocked = await handleAntilink(sock, msg, sender, from, text, botJid);
    if (blocked) return;
  }

  // Public Pairing
  if (!fromMe && text && !text.startsWith(PREFIX)) {
    const handled = await handlePublicPairRequest(sock, msg, from, sender, text);
    if (handled) return;
  }

  // Command Parser
  if (!text || !text.startsWith(PREFIX)) return;

  if (!ownerIsSender) {
    console.log('🔒 Blocked: ' + sender + ' tried command');
    return;
  }

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  console.log('⚡ COMMAND: ' + command);
  sock.sendMessage(from, { react: { text: randomEmoji(), key: msg.key } }).catch(() => {});

  try {
    await runCommand(sock, msg, from, command, args, isGroup);
    console.log('   ✓ done');
  } catch (e) {
    console.error('   ✗ failed:', e.message);
    sock.sendMessage(from, { text: '❌ ' + e.message }).catch(() => {});
  }
}

// ============================================================
//  COMMAND ROUTER
// ============================================================
async function runCommand(sock, msg, from, command, args, isGroup) {
  try {
    switch (command) {
      case 'ping':    return cmdPing(sock, msg, from);
      case 'help':    return cmdHelp(sock, msg, from);
      case 'list':    return cmdList(sock, msg, from);
      case 'menu':    return cmdMenu(sock, msg, from);
      case 'dp':      return cmdProfile(sock, msg, from, args);
      case 'update':  return cmdUpdate(sock, msg, from);
      case 'reboot':  
      case 'restart': return cmdReboot(sock, msg, from);
      case 'pair':    return cmdPair(sock, msg, from, args);
      // ... add other cases as needed
    }
  } catch (e) { throw e; }
}

// ============================================================
//  GLOBAL CRASH GUARDS
// ============================================================
process.on('uncaughtException', (e) => console.error('🔥 uncaughtException:', e?.message || e));
process.on('unhandledRejection', (e) => console.error('🔥 unhandledRejection:', e?.message || e));

startBot();
